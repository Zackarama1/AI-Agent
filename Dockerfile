# Production image for the Concierge app (FastAPI + the Playwright agent).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8000

WORKDIR /app

# Install Python deps, then the Chromium the agent drives plus its OS
# dependencies. We deliberately do NOT set PLAYWRIGHT_CHROMIUM_PATH so the app
# uses the browser installed here.
COPY requirements.txt .
RUN pip install -r requirements.txt \
    && python -m playwright install --with-deps chromium

COPY . .

EXPOSE 8000

# webserver.py binds 0.0.0.0:$PORT (Fly/Render set PORT for you).
CMD ["python", "webserver.py"]
