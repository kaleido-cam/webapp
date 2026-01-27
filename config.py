import os

from flask.cli import load_dotenv

load_dotenv()

# Generate a secret with python3 -c 'import os; print(os.urandom(32).hex())'
SECRET_KEY = os.getenv("SECRET_KEY")

DATABASE = ":memory:"
CONTROL_SERVER_BASE_URL = os.getenv("CONTROL_SERVER_BASE_URL", "http://172.16.33.3:8000")
STREAM_BASE_URL = os.getenv("STREAM_BASE_URL", "https://stream.kaleido.cam")
SENTRY_DSN = os.getenv("SENTRY_DSN")

CAPABILITY_TOKENS = {
    "update_system": os.getenv("TOKEN_UPDATE_SYSTEM", None),
    "voucher": os.getenv("TOKEN_VOUCHER", None),
}