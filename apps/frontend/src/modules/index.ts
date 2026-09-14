import { configureModules, registerModule } from '@/modules/manifest';
import { usersModule } from '@/modules/users';

registerModule(usersModule);
configureModules();
