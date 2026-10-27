"""Regressions for useful next steps and affordability, without provider calls."""
from copy import deepcopy
import json
from pathlib import Path
import pytest
from src.scenarios import build_scenarios
from src.plan_guidance import build_plan_guidance
from src.llm_explanation import generate_explanation_result
from src.validation import validate_profile
from src.evaluation import audit_numeric_grounding


def profile():
    p = deepcopy(json.loads((Path(__file__).parents[1] / 'data/test_cases.json').read_text())['cases'][0]['expected_profile'])
    p.update(monthly_primary_income=10_000_000, monthly_other_income=0,
             monthly_essential_expense=6_000_000, monthly_discretionary_expense=1_000_000,
             monthly_debt_payment=1_000_000, current_savings=30_000_000,
             emergency_fund_reserved=10_000_000, goal_amount=100_000_000,
             goal_horizon_months=24)
    return p


def test_reached_goal_with_unfunded_contribution_is_not_positive():
    p=profile();s=build_scenarios(p,{'annual_return_rate':0,'monthly_contribution':4_000_000})
    m=s['base']['calculation_result'];g=build_plan_guidance(p,m)
    assert m['goal_reached_by_horizon']
    assert not g['feasible'] and not g['positive']
    assert g['budget']['shortfall']==2_000_000
    assert '2.000.000' in g['reason']


def test_actions_distinguish_extra_contribution_from_extra_income():
    p=profile();a={'annual_return_rate':0,'monthly_contribution':1_000_000}
    s=build_scenarios(p,a);g=build_plan_guidance(p,s['base']['calculation_result'])
    assert g['numeric_facts']['additional_monthly_contribution']==pytest.approx(2_333_333.3333333)
    assert s['base']['calculation_result']['required_contribution_gap']==pytest.approx(1_333_333.3333333)
    assert '2.333.333' in g['actions'][0]['text'] and '1.333.333' in g['actions'][0]['text']
    assert g['principal']==44_000_000 and g['investment_gain']==0


def test_existing_goal_capital_does_not_hide_negative_monthly_cashflow():
    p=profile();p.update(monthly_primary_income=5_000_000,goal_amount=10_000_000)
    s=build_scenarios(p,{'annual_return_rate':0});g=build_plan_guidance(p,s['base']['calculation_result'])
    assert s['base']['calculation_result']['goal_reached_by_horizon']
    assert not g['positive'] and g['budget']['shortfall']==3_000_000
    assert g['actions'][0]['title']=='Cân đối sinh hoạt trước'


def test_new_action_amounts_are_audited_without_accepting_invented_numbers():
    p=profile();a={'annual_return_rate':0};s=build_scenarios(p,a);m=s['base']['calculation_result']
    source={'profile':p,'calculation_result':m,'scenario_result':s}
    text=generate_explanation_result(p,m,s,validate_profile(p,a),use_llm=False)['text']
    assert audit_numeric_grounding(text,source)['unsupported_numeric_claims']==[]
    assert audit_numeric_grounding(text+'\n999.999.999 VND',source)['unsupported_numeric_claims']==['999.999.999 VND']


def test_other_scenario_warnings_are_labelled_and_do_not_change_base_verdict():
    p=profile();p.update(goal_amount=65_000_000)
    a={'annual_return_rate':0};s=build_scenarios(p,a);m=s['base']['calculation_result']
    assert m['goal_reached_by_horizon']
    text=generate_explanation_result(p,m,s,validate_profile(p,a),use_llm=False)['text']
    assert 'Thận trọng: Khoản đóng góp cần thiết vượt dòng tiền dư hiện tại.' in text
    assert build_plan_guidance(p,m)['positive']
