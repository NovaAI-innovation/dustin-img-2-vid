from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import ApiEnvelope, BalanceResponse
from app.routers.utils import envelope, raise_pixverse_http_error
from app.services.pixverse_client import PixverseClient, PixverseError

router = APIRouter(prefix="/api/v1/account", tags=["account"])


def get_pixverse_client(settings: Settings = Depends(get_settings)) -> PixverseClient:
    return PixverseClient(api_key=settings.pixverse_api_key, base_url=settings.pixverse_base_url)


@router.get("/balance", response_model=ApiEnvelope)
async def get_balance(pixverse: PixverseClient = Depends(get_pixverse_client)) -> ApiEnvelope:
    try:
        balance = await pixverse.get_balance()
    except PixverseError as exc:
        raise_pixverse_http_error(exc)

    response = BalanceResponse(
        account_id=int(balance.get("account_id", 0)),
        credit_monthly=int(balance.get("credit_monthly", 0)),
        credit_package=int(balance.get("credit_package", 0)),
    )
    return envelope(data=response.model_dump())

