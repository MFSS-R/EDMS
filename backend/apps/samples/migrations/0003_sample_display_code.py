from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0002_experiment_sample_experiment_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sample',
            name='display_code',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='显示编号'),
        ),
    ]
