# ---- install python dependencies ----
FROM python:3.12-slim AS dependencies

WORKDIR /app

COPY requirements.txt ./
RUN python -m venv /opt/venv \
	&& /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
	&& /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ---- runtime image ----
FROM python:3.12-slim AS runner

ENV PATH="/opt/venv/bin:${PATH}" \
	PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system --gid 1001 appgroup \
	&& adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=appuser:appgroup *.py requirements.txt ./
COPY --chown=appuser:appgroup inbox ./inbox
COPY --chown=appuser:appgroup attachments ./attachments

USER appuser

EXPOSE 8000

# Render injects PORT at runtime — this must stay dynamic, not hardcoded
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]