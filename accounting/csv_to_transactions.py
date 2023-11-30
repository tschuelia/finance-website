import datetime
import io

import pandas as pd
from typing import Dict

from .models import get_category


# TODO: hack for now, replace with proper model and allow setting on website
subject_mappings = {
    "fuellhorn": "Füllhorn",
    "alnatura": "Alnatura",
    "rewe": "Rewe",
    "edeka": "Edeka",
    "dm ": "DM",
    "miete juni": "Miete Jonas",
    "bargeldauszahlung": "Bargeld",
    "ettli kaffee": "Ettli Kaffee",
    "yello strom": "Gas",
    "julia schmidkto": "GEZ Rücklage",
}


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
        try:
            subj = str(row.full_subject_string).lower()
        except:
            print("failed to extract subject ", subj)
            raise

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
            rec = recipient.strip()
            subj = subject.strip()
        elif "empfänger:" in subj and "buchungstext:" in subj:
            recipient, subject = subj.split("buchungstext:")
            _, recipient = recipient.split("empfänger:")
            rec = recipient.strip()
            subj = subject.strip()
        else:
            rec = None

        for k, v in subject_mappings.items():
            if k in subj:
                subj = v
                break

        subjects.append(subj)
        recipients.append(rec)

    df["recipient"] = recipients
    df["subject"] = subjects

    return df


def parse_csv_to_dataframe(csv_file, columns):
    content = csv_file.read().decode(encoding="latin-1")
    header_line = content.find('"Buchungstag')
    footer_line = content.find("Umsätze Visa-Karte")
    content = content[header_line:footer_line]

    transactions_df = pd.read_csv(
        io.StringIO(content),
        sep=";",
        encoding="latin-1",
        header=0,
        dtype=str,
    )

    transactions_df = transactions_df[columns.keys()]
    transactions_df.rename(columns=columns, inplace=True)

    # only add transactions that have an issue and a booking date
    transactions_df = transactions_df[lambda x: x.date_booking != "offen"]
    transactions_df = transactions_df[lambda x: x.date_issue != "offen"]

    return transactions_df


def correct_dataframe(transactions_df, fillna_recipient=""):
    transactions_df.dropna(
        subset=["date_issue", "date_booking", "amount", "subject", "recipient"], how="all", inplace=True
    )
    transactions_df = german_date_to_python_date(transactions_df, "date_issue")
    transactions_df = german_date_to_python_date(transactions_df, "date_booking")

    transactions_df.recipient.fillna(fillna_recipient, inplace=True)
    transactions_df.subject.fillna("", inplace=True)

    transactions_df = reformat_german_float_to_python_float(transactions_df)
    transactions_df = categorize(transactions_df)
    return transactions_df


def parse_comdirect_csv_to_dataframe(csv_file):
    columns = {
        "Buchungstag": "date_issue",
        "Wertstellung (Valuta)": "date_booking",
        "Vorgang": "event",
        "Buchungstext": "full_subject_string",
        "Umsatz in EUR": "amount",
    }

    df = parse_csv_to_dataframe(csv_file, columns)
    df = extract_subject_info_comdirect(df)
    df = correct_dataframe(df)
    return df


def parse_dkb_csv_to_dataframe(csv_file):
    # Since September 2023, the column names and some formats changed
    # we can check which format it is based on whether the file contains Zahlungspflichtige*r
    content = csv_file.read().decode(encoding="latin-1")
    if "Zahlungspflichtige*r" in content:
        # New CSV export -> use dedicated function
        csv_file.seek(0)
        return parse_new_dkb_csv_to_dataframe(csv_file)

    csv_file.seek(0)
    columns = {
        "Buchungstag": "date_issue",
        "Wertstellung": "date_booking",
        "Buchungstext": "event",
        "Betrag (EUR)": "amount",
        "Auftraggeber / Begünstigter": "recipient",
        "Verwendungszweck": "subject",
    }

    df = parse_csv_to_dataframe(csv_file, columns)
    df["full_subject_string"] = df["subject"]
    df = correct_dataframe(df, fillna_recipient="DKB AG")

    return df


def parse_new_dkb_csv_to_dataframe(csv_file):
    columns = {
        "Buchungsdatum": "date_issue",
        "Wertstellung": "date_booking",
        "Umsatztyp": "event",
        "Verwendungszweck": "subject",
    }
    content = csv_file.read().decode(encoding="utf-8")
    header_line = content.find("Buchungsdatum")
    content = content[header_line:]
    df = pd.read_csv(
        io.StringIO(content), sep=";", encoding="latin-1", header=0, dtype=str, parse_dates=[0, 1], date_format="%d.%m.%y"
    )
    has_euro_sign_in_values = "Betrag" in df.columns

    if has_euro_sign_in_values:
        columns.update({"Betrag": "amount"})
    else:
        columns.update({"Betrag (€)": "amount"})

    df.rename(columns=columns, inplace=True)
    if has_euro_sign_in_values:
        # remove the euro sign from the amount
        df.amount = df.amount.str.split().str[0]
    df = reformat_german_float_to_python_float(df)

    # now based on the amount we have to select a different column as recipient
    # if the amount is >= 0 (= "Einnahme") use Zahlungspflichtige*r
    # otherwise use "Zahlungsempfänger*in"
    recipients = []
    for idx, row in df.iterrows():
        if row.amount >= 0:
            recipients.append(row["Zahlungspflichtige*r"])
        else:
            recipients.append(row["Zahlungsempfänger*in"])
    df["recipient"] = recipients

    df["full_subject_string"] = df["subject"]
    df = df[list(columns.values()) + ["recipient", "full_subject_string"]]
    df.dropna(subset=["date_issue", "date_booking", "amount", "subject", "recipient"], how="all", inplace=True)

    df.recipient.fillna("DKB AG", inplace=True)
    df.subject.fillna("", inplace=True)
    df = categorize(df)

    return df


def csv_to_transactions(csv_file, account):
    if account.bank.lower() == "comdirect":
        transaction_df = parse_comdirect_csv_to_dataframe(csv_file)
    elif account.bank.lower() == "dkb":
        transaction_df = parse_dkb_csv_to_dataframe(csv_file)
    else:
        raise ValueError("At the moment only CSV exports of Comdirect and DKB are supported.")
    transaction_df["bank_account"] = account
    return transaction_df.to_dict("records")
