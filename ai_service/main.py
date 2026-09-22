import io
import subprocess
import torch
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import (
    WhisperProcessor,
    WhisperForConditionalGeneration,
    AutoTokenizer,
    AutoModelForSeq2SeqLM
)

# 1. Optimisation CPU pour Intel Core i9
torch.set_num_threads(8)

app = FastAPI(
    title="Wolof Audio Translation API",
    description="Microservice d'inférence ASR (M-Kiriku) et Traduction (NLLB-200)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cpu"

print("Chargement du modèle ASR (M-Kiriku)...")
asr_processor = WhisperProcessor.from_pretrained("AIHubSN/m-kiriku-asr")
asr_model = WhisperForConditionalGeneration.from_pretrained("AIHubSN/m-kiriku-asr").to(device)
asr_model.eval()
asr_model.generation_config.suppress_tokens = None
asr_model.generation_config.begin_suppress_tokens = None

print("Chargement du modèle de Traduction (NLLB-200)...")
trans_tokenizer = AutoTokenizer.from_pretrained("galsenai/wolofToFrenchTranslator_nllb")
trans_model = AutoModelForSeq2SeqLM.from_pretrained("galsenai/wolofToFrenchTranslator_nllb").to(device)
trans_model.eval()

print("Tous les modèles sont prêts en mémoire !")

def decode_audio_to_16k_mono(audio_bytes: bytes):
    """
    Décode n'importe quel conteneur (WebM, Opus, Ogg, MP3, WAV)
    directement en format PCM 16kHz mono via FFmpeg.
    """
    cmd = [
        "ffmpeg",
        "-i", "pipe:0",           # Entrée standard (RAM)
        "-f", "wav",              # Format de sortie WAV
        "-ar", "16000",           # Fréquence 16 kHz requise par Whisper
        "-ac", "1",               # 1 seul canal (mono)
        "pipe:1"                  # Sortie standard (RAM)
    ]
    process = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout_data, stderr_data = process.communicate(input=audio_bytes)

    if process.returncode != 0:
        raise RuntimeError(f"Échec décodage FFmpeg : {stderr_data.decode(errors='ignore')}")

    # Lecture du flux WAV converti
    waveform, _ = sf.read(io.BytesIO(stdout_data))
    return torch.tensor(waveform, dtype=torch.float32)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Wolof Speech-to-Text & Translation Pipeline",
        "device": device
    }

@app.post("/pipeline-complet")
async def process_audio(fichier_audio: UploadFile = File(...)):
    nom_fichier = fichier_audio.filename
    contenu_binaire = await fichier_audio.read()
    taille_ko = round(len(contenu_binaire) / 1024, 2)

    try:
        # Décodage universel via FFmpeg (convertit automatiquement en mono 16kHz)
        waveform_tensor = decode_audio_to_16k_mono(contenu_binaire)

        # Inférence ASR : Audio Wolof -> Transcription Wolof
        inputs_asr = asr_processor(
            waveform_tensor.numpy(),
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features.to(device)

        with torch.no_grad():
            predicted_ids = asr_model.generate(inputs_asr)
            transcription = asr_processor.batch_decode(
                predicted_ids,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False
            )[0].strip()

        # Inférence Traduction : Wolof -> Français via NLLB-200
        inputs_trans = trans_tokenizer(transcription, return_tensors="pt").to(device)

        with torch.no_grad():
            translated_tokens = trans_model.generate(
                **inputs_trans,
                forced_bos_token_id=trans_tokenizer.convert_tokens_to_ids("fra_Latn"),
                max_length=128
            )
            traduction = trans_tokenizer.batch_decode(
                translated_tokens,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False
            )[0].strip()

        return {
            "statut": "succès",
            "metadonnees": {
                "nom_fichier": nom_fichier,
                "taille_recue": f"{taille_ko} Ko"
            },
            "resultats": {
                "transcription_wolof": transcription,
                "traduction_francaise": traduction
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du traitement de l'audio : {str(e)}"
        )