from celery import Celery
from app.config import settings

if settings.CELERY_BROKER_URL and settings.CELERY_RESULT_BACKEND:
    celery_app = Celery(
        "devtrack",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
        include=[
            "app.tasks.reminders",
            "app.tasks.email_verification",
        ],
    )
else:
    from unittest.mock import MagicMock

    celery_app = MagicMock()

    def _mock_task(func):
        func.delay = lambda *args, **kwargs: MagicMock()
        return func

    celery_app.task = _mock_task
