import json
import time
import decimal

def _decimal_to_native(obj):
    if isinstance(obj, decimal.Decimal):
        if obj == obj.to_integral_value():
            return int(obj)
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def format_error(message: str, error_code: str) -> dict:
    return {
        "success": False,
        "message": message,
        "errorCode": error_code
    }

def build_response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body, default=_decimal_to_native)
    }

def log_event(request_id: str, event_id: str, action: str, start_time: float, status: str) -> None:
    latency_ms = int((time.time() - start_time) * 1000)
    log_line = {
        "requestId": request_id,
        "eventId": event_id,
        "action": action,
        "latencyMs": latency_ms,
        "status": status
    }
    print(json.dumps(log_line))
