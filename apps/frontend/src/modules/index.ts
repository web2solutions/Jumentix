import { configureModules, findModule, registerModule } from '@/modules/manifest';
import { usersModule } from '@/modules/users';

if (!findModule(usersModule.id)) {
  registerModule(usersModule);
}
configureModules();
