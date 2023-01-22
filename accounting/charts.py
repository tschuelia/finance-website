import calendar
import datetime
import dash_bootstrap_components as dbc
import decimal
import pandas as pd

from collections import defaultdict
from dash import html, dcc
from dash.dependencies import Input, Output, State
from dateutil.relativedelta import relativedelta
from django.shortcuts import get_object_or_404
from django_plotly_dash import DjangoDash
from plotly import graph_objects as go

from .models import BankAccount, Category, TransactionType, get_bank_accounts_for_user

COLOR_INCOME = "darkseagreen"
COLOR_EXPENSE = "indianred"
TEMPLATE = "plotly_white"

dd = DjangoDash("Charts", add_bootstrap_links=True)

dd.layout = html.Div(
    [
        html.Div("", id="_dummy", hidden=True),
        # Bank account dropdown
        html.Div(
            [
                dbc.Label("Bankkonto"),
                dcc.Dropdown(
                    id="account",
                    options=[],
                    value=None,
                ),
            ]
        ),
        # Filters (date, amount, categories, Ausgabetyp)
        html.Hr(),
        html.Div(
            [
                dbc.Row(
                    [
                        dbc.Col(
                            ["Datum"], className="col-2 col-sm-2 col-md-2 col-lg-1"
                        ),
                        dbc.Col(
                            [dbc.Input(id="date-start", type="date")],
                            className="col-5 col-sm-5 col-md-4 col-lg-2",
                        ),
                        dbc.Col(
                            [dbc.Input(id="date-end", type="date")],
                            className="col-5 col-sm-5 col-md-4 col-lg-2",
                        ),
                        dbc.Col([], className="col-0 col-sm-0 col-md-2 col-lg-7"),
                    ]
                ),
                html.Br(),
                dbc.Row(
                    [
                        dbc.Col(
                            ["Betrag"], className="col-2 col-sm-2 col-md-2 col-lg-1"
                        ),
                        dbc.Col(
                            [
                                dbc.Input(
                                    id="amount-min", type="number", min=0.0, step=0.01
                                )
                            ],
                            className="col-5 col-sm-5 col-md-4 col-lg-2",
                        ),
                        dbc.Col(
                            [
                                dbc.Input(
                                    id="amount-max", type="number", min=0.0, step=0.01
                                )
                            ],
                            className="col-5 col-sm-5 col-md-4 col-lg-2",
                        ),
                        dbc.Col([], className="col-0 col-sm-0 col-md-2 col-lg-7"),
                    ]
                ),
                html.Br(),
                dbc.Row(
                    [
                        dbc.Col(
                            ["Kategorien"], className="col-2 col-sm-2 col-md-2 col-lg-1"
                        ),
                        dbc.Col(
                            dcc.Dropdown(
                                id="categories",
                                options=[],
                                value=None,
                                placeholder="Kategorien",
                                multi=True,
                            ),
                            className="col-8 col-sm-8 col-md-8 col-lg-4",
                        ),
                        dbc.Col([], className="col-2 col-sm-2 col-md-2 col-lg-7"),
                    ]
                ),
                html.Br(),
                dbc.Row(
                    [
                        dbc.Col(
                            ["Typ"], className="col-2 col-sm-2 col-md-2 col-lg-1"
                        ),
                        dbc.Col(
                            dcc.Dropdown(
                                id="transaction-type",
                                options=[],
                                value=None,
                                placeholder="Transaktionsart",
                            ),
                            className="col-8 col-sm-8 col-md-8 col-lg-4",
                        ),
                        dbc.Col([], className="col-2 col-sm-2 col-md-2 col-lg-7"),
                    ]
                ),
                html.Br(),
                dbc.Row(
                    [
                        dbc.Col(
                            [
                                dbc.Button(
                                    "Reset",
                                    id="reset-filter",
                                    className="btn btn-light",
                                )
                            ],
                            className="col-3 col-sm-4 col-md-4 col-lg-4",
                        ),
                        dbc.Col(
                            [
                                dbc.Button(
                                    "Filtern",
                                    id="filter",
                                    className="btn btn-light btn active",
                                )
                            ],
                            className="col-3 col-sm-4 col-md-4 col-lg-1",
                        ),
                        dbc.Col([], className="col-6 col-sm-4 col-md-4 col-lg-7"),
                    ]
                )
            ]
        ),
        html.Hr(style={"border": "1px solid gray"}),
        # Plots
        html.Div(
            [
                # Pie chart category overview all time
                html.Div(
                    [
                        html.H3("Nach Kategorien (gesamte Zeit)"),
                        dcc.Graph(id="category-chart"),
                    ]
                ),
                html.Hr(),
                # Pie chart category overview monthly
                html.Div(
                    [
                        html.H3("Nach Kategorien"),
                        html.P("Wenn 'Jahr' im ersten Dropdown ausgewählt ist, wir das gesamte Jahr angezeigt."),
                        html.Br(),
                        dbc.Row(
                            [
                                dbc.Col(
                                    [
                                        dbc.Row(
                                            [
                                                dbc.Col([dcc.Dropdown(id="monthly-month1", value=None, options=[], placeholder="Monat"),]),
                                                dbc.Col([dcc.Dropdown(id="monthly-year1", value=None, options=[], placeholder="Jahr")]),
                                            ]
                                        ),
                                        dcc.Graph(id="category-chart-monthly-month1"),
                                    ]
                                ),
                                dbc.Col(
                                    [
                                        dbc.Row(
                                            [
                                                dbc.Col([dcc.Dropdown(id="monthly-month2", value=None, options=[], placeholder="Monat"),]),
                                                dbc.Col([dcc.Dropdown(id="monthly-year2", value=None, options=[], placeholder="Jahr")]),
                                            ]
                                        ),
                                        dcc.Graph(id="category-chart-monthly-month2"),
                                    ]
                                ),
                                dbc.Col(
                                    [
                                        dbc.Row(
                                            [
                                                dbc.Col([dcc.Dropdown(id="monthly-month3", value=None, options=[], placeholder="Monat"),]),
                                                dbc.Col([dcc.Dropdown(id="monthly-year3", value=None, options=[], placeholder="Jahr")]),
                                            ]
                                        ),
                                        dcc.Graph(id="category-chart-monthly-month3"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                ),
                html.Hr(),
                # Bar char expensens and income monthly
                html.Div(
                    [
                        html.H3("Ein-/Ausgaben nach Monaten"),
                        dbc.Row(
                            [
                                dbc.Col("Zeige die letzten ", width=2),
                                dbc.Col(
                                    dbc.Input(
                                        id="time-series-spendings-months",
                                        type="number",
                                        step=1,
                                        min=0,
                                    ),
                                    width=1,
                                ),
                                dbc.Col("Monate.", width=1),
                            ]
                        ),
                        dcc.Graph(id="time-series-spendings"),
                    ]
                ),
            ]
        ),
    ],
    style={"height": "100vh"},
)


def _django_transactions_to_pandas_dataframe(transactions):
    df = pd.DataFrame(list(transactions.values()))
    df.date_issue = pd.to_datetime(df.date_issue, infer_datetime_format=True)
    df.amount = df.amount.astype(float)
    df["year_issue"] = pd.DatetimeIndex(df.date_issue).year
    df["month_issue"] = pd.DatetimeIndex(df.date_issue).month
    return df


@dd.expanded_callback(
    Output("account", "options"),
    Output("account", "value"),
    Input("_dummy", "children"),
)
def populate_bank_account_dropdown(_, **kwargs):
    accounts = get_bank_accounts_for_user(kwargs["user"])
    if len(accounts) == 0:
        return [], "Du hast noch keine Bankkonten angelegt."
    options = [{"label": str(acc), "value": acc.pk} for acc in accounts]
    return options, accounts[0].pk


@dd.expanded_callback(
    Output("transaction-type", "options"),
    Output("transaction-type", "value"),
    Input("_dummy", "children"),
)
def populate_transaction_type_dropdown(_):
    values = [{"label": ta.value, "value": ta.value} for ta in TransactionType]
    return values, TransactionType.EXPENSE.value


@dd.expanded_callback(
    # chart 1
    Output("monthly-month1", "options"),
    Output("monthly-month1", "value"),
    Output("monthly-year1", "options"),
    Output("monthly-year1", "value"),
    # chart 2
    Output("monthly-month2", "options"),
    Output("monthly-month2", "value"),
    Output("monthly-year2", "options"),
    Output("monthly-year2", "value"),
    # chart 3
    Output("monthly-month3", "options"),
    Output("monthly-month3", "value"),
    Output("monthly-year3", "options"),
    Output("monthly-year3", "value"),
    Input("account", "value"),
    Input("_dummy", "children"),
)
def populate_monthly_spendings_month_dropdown(account, _):
    account = get_object_or_404(BankAccount, pk=account)

    min_date = account.get_oldest_transaction_date()
    max_date = account.get_newest_transaction_date()

    min_year = min_date.year
    max_year = max_date.year

    months = ["Jahr", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
    month_values = [{"label": str(m), "value": i} for (i, m) in enumerate(months)]
    year_values = [{"label": str(y), "value": y} for y in range(min_year, max_year + 1)]

    two_months_back = max_date + relativedelta(months=-2)
    preset_month1= two_months_back.month
    preset_year1 = two_months_back.year

    settings1 = (month_values, preset_month1, year_values, preset_year1)

    one_month_back = max_date + relativedelta(months=-1)
    preset_month2 = one_month_back.month
    preset_year2 = one_month_back.year

    settings2 = (month_values, preset_month2, year_values, preset_year2)

    preset_month3 = max_date.month
    preset_year3 = max_date.year

    settings3 = (month_values, preset_month3, year_values, preset_year3)

    return *settings1, *settings2, *settings3


@dd.expanded_callback(
    Output("categories", "options"),
    Output("categories", "value"),
    Input("_dummy", "children"),
)
def populate_categories_dropdown(_, **kwargs):
    categories = Category.objects.all()
    if len(categories) == 0:
        return [], "Es gibt noch keine Kategorien."
    options = [{"label": str(acc), "value": acc.pk} for acc in categories]
    return options, None

@dd.expanded_callback(
    Output("date-start", "value"),
    Output("date-end", "value"),
    Output("amount-min", "value"),
    Output("amount-max", "value"),
    Output("categories", "value"),
    Input("reset-filter", "n_clicks")
)
def reset_filter(_):
    print("RESET")
    return None, None, None, None, -1


def _accumulate_by_categories(transactions):
    category_spendings = defaultdict(decimal.Decimal)

    for t in transactions:
        if t.category:
            category_spendings[t.category.name] += abs(t.amount)
        else:
            category_spendings["ohne Kategorie"] += abs(t.amount)

    category_spendings = dict(
        sorted(category_spendings.items(), key=lambda item: item[1], reverse=True)
    )

    return category_spendings


@dd.expanded_callback(
    Output("category-chart", "figure"),
    Input("account", "value"),
    Input("filter", "n_clicks"),
    State("date-start", "value"),
    State("date-end", "value"),
    State("amount-min", "value"),
    State("amount-max", "value"),
    State("categories", "value"),
    State("transaction-type", "value"),
)
def spendings_category_chart(
    account, _, date_start, date_end, amount_min, amount_max, categories, transaction_type
):
    account = get_object_or_404(BankAccount, pk=account)

    transaction_type = TransactionType(transaction_type)

    if transaction_type == TransactionType.INCOME:
        marker_color = COLOR_INCOME
    elif transaction_type == TransactionType.EXPENSE:
        marker_color = COLOR_EXPENSE
    else:
        marker_color = "blue"

    transactions = account.get_transactions(
        search_term=None,
        date_start=date_start,
        date_end=date_end,
        amount_min=amount_min,
        amount_max=amount_max,
        categories=categories,
        transaction_type=TransactionType(transaction_type)
    )

    category_spendings = _accumulate_by_categories(transactions)

    fig = go.Figure(
        go.Bar(
            x=list(category_spendings.keys()),
            y=list(category_spendings.values()),
            marker_color=marker_color
        )
    )

    fig.update_xaxes(title="Kategorie")
    fig.update_yaxes(title="Betrag", ticksuffix="€")
    fig.update_layout(template=TEMPLATE)

    return fig


def _get_categorized_transactions_for_month(
    account, month, year, amount_min, amount_max, categories, transaction_type
):
    if month == 0:
        # show the entire year
        date_start = datetime.date(day=1, month=1, year=year)
        date_end = datetime.date(day=31, month=12, year=year)
    else:
        date_start = datetime.date(day=1, month=month, year=year)
        _, max_day = calendar.monthrange(year=year, month=month)
        date_end = datetime.date(day=max_day, month=month, year=year)

    transactions = account.get_transactions(
        date_start=date_start,
        date_end=date_end,
        amount_min=amount_min,
        amount_max=amount_max,
        categories=categories,
        transaction_type=TransactionType(transaction_type)
    )

    return _accumulate_by_categories(transactions)


def _plot_categories_for_month(account, month1, year1, amount_min, amount_max, categories, transaction_type):
    category_spendings = _get_categorized_transactions_for_month(
        account, month1, year1, amount_min, amount_max, categories, transaction_type
    )

    transaction_type = TransactionType(transaction_type)

    if transaction_type == TransactionType.EXPENSE:
        marker_color = COLOR_EXPENSE
    elif transaction_type == TransactionType.INCOME:
        marker_color = COLOR_INCOME
    else:
        marker_color = "blue"

    fig = go.Figure(
        go.Bar(
            x=list(category_spendings.keys()),
            y=list(category_spendings.values()),
            showlegend=False,
            marker_color=marker_color
        )
    )
    fig.update_xaxes(title="Kategorie")
    fig.update_yaxes(title="Betrag", ticksuffix="€")
    fig.update_layout(template=TEMPLATE)

    return fig


@dd.expanded_callback(
    Output("category-chart-monthly-month1", "figure"),
    Output("category-chart-monthly-month2", "figure"),
    Output("category-chart-monthly-month3", "figure"),
    # INPUT
    Input("account", "value"),
    Input("filter", "n_clicks"),
    # dropdown month and year options
    Input("monthly-month1", "value"),
    Input("monthly-year1", "value"),
    Input("monthly-month2", "value"),
    Input("monthly-year2", "value"),
    Input("monthly-month3", "value"),
    Input("monthly-year3", "value"),
    # STATE: filter options
    State("amount-min", "value"),
    State("amount-max", "value"),
    State("categories", "value"),
    State("transaction-type", "value")
)
def spendings_category_chart_monthly(account, _, month1, year1, month2, year2, month3, year3,
                                     amount_min, amount_max, categories, transaction_type):
    account = get_object_or_404(BankAccount, pk=account)

    fig1 = _plot_categories_for_month(account, month1, year1, amount_min, amount_max, categories, transaction_type)
    fig2 = _plot_categories_for_month(account, month2, year2, amount_min, amount_max, categories, transaction_type)
    fig3 = _plot_categories_for_month(account, month3, year3, amount_min, amount_max, categories, transaction_type)

    return fig1, fig2, fig3


@dd.expanded_callback(
    Output("time-series-spendings", "figure"),
    Input("account", "value"),
    Input("filter", "n_clicks"),
    Input("time-series-spendings-months", "value"),
    State("date-start", "value"),
    State("date-end", "value"),
    State("amount-min", "value"),
    State("amount-max", "value"),
    State("categories", "value"),
)
def spendings_time_series_bar_chart(
    account, _, last_n_months, date_start, date_end, amount_min, amount_max, categories
):
    account = get_object_or_404(BankAccount, pk=account)

    if last_n_months is not None:
        _date_min = datetime.date.today() + relativedelta(months=-last_n_months)
        _date_min = datetime.date(day=1, month=_date_min.month, year=_date_min.year)

        if date_start is None:
            date_start = _date_min
        else:
            date_start = max(date_start, _date_min)

    transactions = account.get_transactions(
        search_term=None,
        date_start=date_start,
        date_end=date_end,
        amount_min=amount_min,
        amount_max=amount_max,
        categories=categories,
        transaction_type=TransactionType.ALL
    )

    if len(transactions) == 0:
        return go.Figure()

    df = _django_transactions_to_pandas_dataframe(transactions)

    is_income = df.amount >= 0
    income = df.loc[is_income]
    expenses = df.loc[~is_income]

    income = income.groupby(["year_issue", "month_issue"]).sum(numeric_only=True)
    expenses = expenses.groupby(["year_issue", "month_issue"]).sum(numeric_only=True)

    fig = go.Figure(
        [
            go.Bar(
                x=[str(el) for el in income.index.to_list()],
                y=income.amount.to_list(),
                marker_color=COLOR_INCOME,
                name="Einnahmen",
            ),
            go.Bar(
                x=[str(el) for el in expenses.index.to_list()],
                y=expenses.amount.abs().to_list(),
                marker_color=COLOR_EXPENSE,
                name="Ausgaben",
            ),
        ]
    )

    fig.update_xaxes(title="(Monat, Jahr)")
    fig.update_yaxes(title="Betrag", ticksuffix="€")
    fig.update_layout(template=TEMPLATE)
    return fig
