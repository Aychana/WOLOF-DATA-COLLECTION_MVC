import time
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

# 1. Instance de l'application
app = FastAPI(
    title="Wolof Audio Translation API",
    description="Microservice d'inférence ASR (M-Kiriku) et Traduction (NLLB-200)",
    version="1.0.0",
)

# 2. Sécurité réseau : Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Route de santé (Health Check)
@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Wolof Speech-to-Text Pipeline"
    }

# 4. Route principale de traitement audio
@app.post("/pipeline-complet")
async def process_audio(fichier_audio: UploadFile = File(...)):
    nom_fichier = fichier_audio.filename
    contenu_binaire = await fichier_audio.read()
    taille_ko = round(len(contenu_binaire) / 1024, 2)

    # # Simulation du délai d'inférence IA
    # time.sleep(0.5)

    return {
        "statut": "succès",
        "metadonnees": {
            "nom_fichier": nom_fichier,
            "taille_recue": f"{taille_ko} Ko"
        },
        "resultats": {
            "transcription_wolof": "Xamnaa kan mooy baay ji.",
            "traduction_francaise": "Je sais qui est le père."
        }
    }