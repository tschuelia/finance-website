import datetime
import io

import pandas as pd
from typing import Dict

from .models import get_category_for_pattern, get_category



def categorize(df):
    categories = []
    for idx, row in df.iterrows():
        cat = get_category(row.recipient, row.subject)
        categories.append(cat)

    df["category"] = categories
    return df


def reformat_german_float_to_python_float(df):
    # first replace dots with empty strings:
    # 1.234,56 -> 1234,56
    amounts = [val.replace(".", "") for val in df.amount]

    # next replace commas with dots:
    # 1234,56 -> 1234.56
    amounts = [val.replace(",", ".") for val in amounts]

    # finally convert the strings to floats and return
    df["amount"] = [float(val) for val in amounts]
    return df


def german_date_to_python_date(df, date_col):
    def _fmt(args):
        idx, row = args
        day, month, year = row[date_col].split(".")
        return datetime.date(day=int(day), month=int(month), year=int(year))

    df[date_col] = list(map(_fmt, df.iterrows()))
    return df


def extract_subject_info_comdirect(df):
    subjects = []
    recipients = []

    for idx, row in df.iterrows():
        subj = row.full_subject_string.lower()

        if "ref." in subj:
            subj, _ = subj.split("ref.")

        if "kfn" in subj:
            subj, _ = subj.split("kfn")

        if row.event == "Entgelte":
            subjects.append(subj)
            recipients.append("Bank Entgelt")
            continue
        elif row.event == "Rücklastschrift":
            subjects.append(subj)
            recipients.append("Rücklastschrift")
            continue
        elif row.event == "Bar":
            subjects.append("Bargeldeinzahlung")
            recipients.append("Bank Einzahlung Bar")
            continue
        elif row.event == "Kontoführungsentgelt" and "visa" in subj:
            subjects.append("Kontoführungsentgelt Visa Card")
            recipients.append("Bank Entgelt")
            continue

        if "auftraggeber:" in subj and "buchungstext:" in subj:
            recipient, subject = subj.split("buchungstext:")
            _, recipient = recipient.split("auftraggeber:")
            recipients.append(recipient.strip())
            subjects.append(subject.strip())
        elif "empfänger:" in subj and "buchungstext:" in subj:
            recipient, subject = subj.split("buchungstext:")
            _, recipient = recipient.split("empfänger:")
            recipients.append(recipient.strip())
            subjects.append(subject.strip())
        else:
            recipients.append(None)
            subjects.append(subj)

    df["recipient"] = recipients
    df["subject"] = subjects

    return df


def read_comdirect_export(f, header_line: int, columns: Dict[str, str]):
    df = pd.read_csv(
        f,
        sep=";",
        encoding="latin-1",
        header=header_line,
        dtype=str,
    )

    df = df[columns.keys()]
    df = df.rename(columns=columns)
    df = df.dropna()
    df = extract_subject_info_comdirect(df)
    df = categorize(df)
    df = reformat_german_float_to_python_float(df)

    return df


def parse_comdirect_csv_to_dataframe(csv_file):
    columns = {
        "Buchungstag": "date_issue",
        "Wertstellung (Valuta)": "date_booking",
        "Vorgang": "event",
        "Buchungstext": "full_subject_string",
        "Umsatz in EUR": "amount",
    }

    content = csv_file.read().decode(encoding="latin-1")
    header_line = content.find("\"Buchungstag")
    content = content[header_line:]

    transactions_df = read_comdirect_export(
        io.StringIO(content),
        header_line=0,
        columns=columns,
    )

    # only add transactions that have an issue and a booking date
    transactions_df = transactions_df[lambda x: x.date_booking != "offen"]
    transactions_df = transactions_df[lambda x: x.date_issue != "offen"]

    transactions_df = german_date_to_python_date(transactions_df, "date_issue")
    transactions_df = german_date_to_python_date(transactions_df, "date_booking")

    return transactions_df


def csv_to_transactions(csv_file, account):
    transaction_df = parse_comdirect_csv_to_dataframe(csv_file)
    transaction_df["bank_account"] = account
    return transaction_df.to_dict("records")
