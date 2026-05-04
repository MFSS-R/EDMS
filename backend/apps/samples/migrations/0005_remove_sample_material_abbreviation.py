from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0004_alter_sample_preparation_conditions'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='sample',
            name='material_abbreviation',
        ),
    ]
