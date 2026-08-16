from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class DashboardPeriod:
    start_month: str
    end_month: str
    label: str
    month_count: int
    is_partial: bool


@dataclass(frozen=True, slots=True)
class ComparedMetric:
    value: Decimal
    previous_value: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CashFlowSummary:
    income: ComparedMetric
    expense: ComparedMetric
    net: ComparedMetric
    savings_rate: ComparedMetric | None


@dataclass(frozen=True, slots=True)
class MonthlyCashFlow:
    period: str
    label: str
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True, slots=True)
class AccountCashFlow:
    account_id: int
    account_name: str
    owner_name: str
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True, slots=True)
class CategoryCashFlow:
    category_id: int | None
    category: str
    expense: Decimal
    previous_expense: Decimal
    share: Decimal
    previous_share: Decimal


@dataclass(frozen=True, slots=True)
class CategoryMonth:
    period: str
    category_id: int | None
    category: str
    expense: Decimal


@dataclass(frozen=True, slots=True)
class ContractExpense:
    contract_id: int
    contract_name: str
    owner_name: str
    is_active: bool
    expense: Decimal
    monthly_average: Decimal
    share: Decimal


@dataclass(frozen=True, slots=True)
class ContractMonth:
    period: str
    contract_id: int
    expense: Decimal


@dataclass(frozen=True, slots=True)
class SpendingAnomaly:
    period: str
    category_id: int | None
    category: str
    expense: Decimal
    baseline_median: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CategoryChange:
    category_id: int | None
    category: str
    monthly_average: Decimal
    previous_monthly_average: Decimal
    absolute_change: Decimal
    percentage_change: Decimal | None


@dataclass(frozen=True, slots=True)
class CashFlowDashboard:
    period: DashboardPeriod
    comparison_period: DashboardPeriod
    data_through: date | None
    account_ids: tuple[int, ...]
    excluded_transfer_count: int
    summary: CashFlowSummary
    monthly: tuple[MonthlyCashFlow, ...]
    accounts: tuple[AccountCashFlow, ...]
    categories: tuple[CategoryCashFlow, ...]
    category_monthly: tuple[CategoryMonth, ...]
    contracts: tuple[ContractExpense, ...]
    contract_monthly: tuple[ContractMonth, ...]
    contract_expense_share: Decimal
    anomalies: tuple[SpendingAnomaly, ...]
    increases: tuple[CategoryChange, ...]
    decreases: tuple[CategoryChange, ...]


@dataclass(frozen=True, slots=True)
class WealthPoint:
    period: str
    label: str
    total: Decimal | None
    bank_balance: Decimal
    depot_balance: Decimal | None
    estimated: bool
    coverage: Decimal


@dataclass(frozen=True, slots=True)
class WealthSource:
    source_type: str
    source_id: int
    name: str
    owner_name: str
    balance: Decimal
    last_update: date


@dataclass(frozen=True, slots=True)
class WealthDashboard:
    period: DashboardPeriod
    current_total: Decimal
    liquid_total: Decimal
    invested_total: Decimal
    period_start_total: Decimal | None
    period_end_total: Decimal | None
    absolute_change: Decimal | None
    percentage_change: Decimal | None
    monthly: tuple[WealthPoint, ...]
    sources: tuple[WealthSource, ...]
