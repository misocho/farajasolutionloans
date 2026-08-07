from pydantic import BaseModel


class NotificationPrefs(BaseModel):
    due_today: bool = True
    due_tomorrow: bool = True
    almost_due: bool = True
    arrears: bool = True
    repayment_pending: bool = True
    pending_approval: bool = True


class NotificationPrefsResponse(BaseModel):
    preferences: NotificationPrefs


class UpdateNotificationPrefsRequest(BaseModel):
    preferences: NotificationPrefs
