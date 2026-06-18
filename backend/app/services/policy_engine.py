from app.schemas.api import Decision


def route_content(confidence: float, review_threshold: float, reject_threshold: float) -> Decision:
    if confidence >= reject_threshold:
        return "AUTO_REJECT"
    if confidence >= review_threshold:
        return "HUMAN_REVIEW"
    return "AUTO_APPROVE"
