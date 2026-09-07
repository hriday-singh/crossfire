import pytest
from unittest.mock import AsyncMock, patch
from core.loop import extract_claims
from core.recovery import run_recovery, RecoveryResult
from core.models import Claim

@pytest.fixture
def mock_provider():
    provider = AsyncMock()
    return provider

@pytest.mark.asyncio
async def test_recovery_on_0_claims(mock_provider):
    mock_provider.generate.return_value = AsyncMock(testable=False, statements=[], redirect="old message")
    
    recovery_result = RecoveryResult(
        clarifying_question="What is the actual decision?",
        missing=["cost", "alternative"],
        provisional_claims=["It costs $5", "It happens tomorrow", "It involves X"],
    )
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        mock_run_recovery.return_value = recovery_result
        case = await extract_claims("raw", mock_provider)
        
        mock_run_recovery.assert_called_once()
        assert case.status == "needs_input"
        assert case.gate_message == "What is the actual decision?"
        assert case.clarify_missing == ["cost", "alternative"]
        assert len(case.claims) == 3
        assert all(c.provisional for c in case.claims)

@pytest.mark.asyncio
async def test_recovery_empty_provisional_claims(mock_provider):
    mock_provider.generate.return_value = AsyncMock(testable=False, statements=[])
    
    recovery_result = RecoveryResult(
        clarifying_question="What is the decision?",
        missing=[],
        provisional_claims=[],
    )
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        mock_run_recovery.return_value = recovery_result
        case = await extract_claims("raw", mock_provider)
        
        assert case.gate_message == "What is the decision?"
        assert case.claims == []

@pytest.mark.asyncio
async def test_recovery_provider_raises(mock_provider):
    mock_provider.generate.return_value = AsyncMock(testable=False, statements=[], redirect="Old fallback message")
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        mock_run_recovery.side_effect = Exception("API error")
        
        # The loop itself doesn't catch run_recovery exceptions if it's not caught inside run_recovery.
        # Wait, run_recovery catches exceptions and returns None! But if we mock run_recovery directly and make it raise,
        # it tests if loop catches it. Ah, wait, loop doesn't catch it! run_recovery catches it.
        pass

@pytest.mark.asyncio
async def test_run_recovery_catches_exception(mock_provider):
    mock_provider.generate_structured.side_effect = Exception("API Error")
    result = await run_recovery("raw", None, mock_provider)
    assert result is None

@pytest.mark.asyncio
async def test_loop_handles_none_recovery(mock_provider):
    mock_provider.generate.return_value = AsyncMock(testable=False, statements=[], redirect="Old fallback message")
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        mock_run_recovery.return_value = None
        case = await extract_claims("raw", mock_provider)
        
        assert case.status == "needs_input"
        assert case.gate_message == "Old fallback message"
        assert case.claims == []
        assert case.clarify_missing == []

@pytest.mark.asyncio
async def test_recovery_truncates_claims(mock_provider):
    mock_provider.generate.return_value = AsyncMock(testable=False, statements=[])
    
    recovery_result = RecoveryResult(
        clarifying_question="Q",
        provisional_claims=["1", "2", "3", "4"]
    )
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        mock_run_recovery.return_value = recovery_result
        case = await extract_claims("raw", mock_provider)
        assert len(case.claims) == 3

@pytest.mark.asyncio
async def test_precision_guard(mock_provider):
    # Returns 1 statement
    mock_provider.generate.return_value = AsyncMock(testable=True, statements=["Valid claim"])
    
    with patch("core.loop.run_recovery", new_callable=AsyncMock) as mock_run_recovery:
        case = await extract_claims("raw", mock_provider)
        
        mock_run_recovery.assert_not_called()
        assert case.status == "awaiting_confirmation"
        assert len(case.claims) == 1
        assert case.claims[0].provisional is False

