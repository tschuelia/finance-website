# Generated by Django 3.2.23 on 2024-02-13 14:04

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0006_auto_20240213_1444"),
    ]

    operations = [
        migrations.AlterField(
            model_name="transaction",
            name="contract",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="contract",
                to="accounting.contract",
                verbose_name="Vertrag",
            ),
        ),
    ]
