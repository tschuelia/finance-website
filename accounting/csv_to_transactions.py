import io

import pandas as pd

from .models import get_category


def categorize(df):
    categories = []
    for idx, row in df.iterrows():
        try:
            cat = get_category(row.recipient, row.subject)
        except:
            print("failed to categorize ", row.recipient, row.subject)
            raise
        categories.append(cat)

    df["category"] = categories
    return df


def _extract_subject_info_comdirect(df):
    subjects = []
    recipients = []

    for idx, row in df.iterrows():
        try:
            subj = str(row.full_subject_string).lower()
        except:
            print("failed to extract subject ", row.full_subject_string)
            raise

        for s in ["ref.", "kfn", "karte"]:
            if s in subj:
                subj, _ = subj.split(s, maxsplit=1)

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

        subjects.append(subj)
        recipients.append(rec)

    df["recipient"] = recipients
    df["subject"] = subjects

    return df


def parse_comdirect_csv_to_dataframe(csv_file):
    columns = {
        "Buchungstag": "date_issue",
        "Wertstellung (Valuta)": "date_booking",
        "Vorgang": "event",
        "Buchungstext": "subject",
        "Umsatz in EUR": "amount",
    }

    content = csv_file.read().decode(encoding="latin-1")
    header_line = content.find('"Buchungstag')
    footer_line = content.find("Umsätze Visa-Karte")
    content = content[header_line:footer_line]

    df = parse_csv(content, columns)

    df = df[lambda x: (x.date_booking != "offen") & (x.date_issue != "offen")]
    df = _extract_subject_info_comdirect(df)
    return df


def parse_dkb_csv_to_dataframe(csv_file):
    columns = {
        "Buchungsdatum": "date_issue",
        "Wertstellung": "date_booking",
        "Umsatztyp": "event",
        "Verwendungszweck": "subject",
        "Betrag (€)": "amount",
    }

    content = csv_file.read().decode(encoding="utf-8")
    header_line = content.find("Buchungsdatum")
    content = content[header_line:]
    df = parse_csv(content, columns, fillna_recipient="DKB AG", dateformat="%d.%m.%y")

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
    return df


def parse_holvi_csv_to_dataframe(csv_file):
    columns = {
        "Zahlungsdatum": "date_issue",
        "Buchungsdatum": "date_booking",
        "Gegenpartei": "recipient",
        "Betrag": "amount",
        "Referenz": "subject",
    }
    content = csv_file.read().decode(encoding="utf-8")
    header_line = content.find("Zahlungsdatum")
    content = content[header_line:]
    return parse_csv(content, columns, fillna_subject=lambda x: x.Nachricht)


def parse_n26_csv_to_dataframe(csv_file):
    columns = {
        "Booking Date": "date_issue",
        "Value Date": "date_booking",
        "Partner Name": "recipient",
        "Payment Reference": "subject",
        "Amount (EUR)": "amount",
    }

    content = csv_file.read().decode(encoding="utf-8")
    return parse_csv(
        content,
        columns,
        fillna_subject=lambda x: x.recipient,
        dateformat="%Y-%m-%d",
        german_float=False,
    )


def parse_csv(
    content,
    columns,
    fillna_recipient="",
    fillna_subject="",
    dateformat="%d.%m.%Y",
    german_float=True,
):
    dtypes = {orig: float if new == "amount" else str for orig, new in columns.items()}

    df = pd.read_csv(
        io.StringIO(content),
        sep=";",
        encoding="utf-8",
        header=0,
        dtype=dtypes,
        **{"thousands": ".", "decimal": ","} if german_float else {},
    )

    df.rename(columns=columns, inplace=True)

    df.date_booking = pd.to_datetime(df.date_booking, format=dateformat)
    df.date_issue = pd.to_datetime(df.date_issue, format=dateformat)

    df.fillna(
        {
            "recipient": fillna_recipient,
            "subject": fillna_subject
            if isinstance(fillna_subject, str)
            else fillna_subject(df),
        },
        inplace=True,
    )
    df["full_subject_string"] = df.subject
    # df = df[list(columns.values()) + ["full_subject_string"]]
    df.dropna(
        subset=["date_issue", "date_booking", "amount", "subject"],
        how="all",
        inplace=True,
    )

    return df


def csv_to_transactions(csv_file, account):
    if account.bank.lower() == "comdirect":
        transaction_df = parse_comdirect_csv_to_dataframe(csv_file)
    elif account.bank.lower() == "dkb":
        transaction_df = parse_dkb_csv_to_dataframe(csv_file)
    elif account.bank.lower() == "holvi":
        transaction_df = parse_holvi_csv_to_dataframe(csv_file)
    elif account.bank.lower() == "n26":
        transaction_df = parse_n26_csv_to_dataframe(csv_file)
    else:
        raise ValueError(
            "At the moment only CSV exports of Comdirect, DKB, N26, or Holvi are supported."
        )
    transaction_df = categorize(transaction_df)
    transaction_df["bank_account"] = account
    return transaction_df.to_dict("records")
