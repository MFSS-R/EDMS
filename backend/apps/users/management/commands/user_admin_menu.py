from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


User = get_user_model()


class Command(BaseCommand):
    help = 'Interactive menu for listing users and promoting a user to admin.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('EDMS User Admin Menu'))
        self.stdout.write('Only listing users and promoting users to admin are supported.\n')

        while True:
            self.stdout.write('1. List all users')
            self.stdout.write('2. Promote user to admin')
            self.stdout.write('3. Exit')
            choice = input('\nSelect an option: ').strip()

            if choice == '1':
                self.list_users()
            elif choice == '2':
                self.promote_user()
            elif choice == '3':
                self.stdout.write(self.style.WARNING('Exited.'))
                return
            else:
                self.stdout.write(self.style.ERROR('Invalid option.\n'))

    def list_users(self):
        users = User.objects.all().order_by('id')
        if not users.exists():
            self.stdout.write(self.style.WARNING('No users found.\n'))
            return

        self.stdout.write('')
        self.stdout.write('ID | USERNAME | STAFF | SUPERUSER | ACTIVE')
        self.stdout.write('-' * 48)
        for user in users:
            self.stdout.write(
                f'{user.id} | {user.username} | {int(user.is_staff)} | '
                f'{int(user.is_superuser)} | {int(user.is_active)}'
            )
        self.stdout.write('')

    def promote_user(self):
        username = input('Enter username to promote: ').strip()
        if not username:
            self.stdout.write(self.style.ERROR('Username cannot be empty.\n'))
            return

        user = User.objects.filter(username=username).first()
        if not user:
            self.stdout.write(self.style.ERROR(f'User not found: {username}\n'))
            return

        if user.is_staff and user.is_superuser:
            self.stdout.write(self.style.WARNING(f'{username} is already an admin.\n'))
            return

        confirm = input(f'Promote "{username}" to admin? (y/N): ').strip().lower()
        if confirm != 'y':
            self.stdout.write(self.style.WARNING('Cancelled.\n'))
            return

        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=['is_staff', 'is_superuser'])
        self.stdout.write(self.style.SUCCESS(f'{username} has been promoted to admin.\n'))
