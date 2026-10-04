import {
  cibCcAmex,
  cibCcApplePay,
  cibCcMastercard,
  cibCcPaypal,
  cibCcStripe,
  cibCcVisa,
  cibFacebook,
  cibGoogle,
  cibLinkedin,
  cibTwitter,
  cifBr,
  cifEs,
  cifFr,
  cifIn,
  cifPl,
  cifUs,
  cilArrowBottom,
  cilArrowTop,
  cilBell,
  cilCalendar,
  cilCheck,
  cilCheckCircle,
  cilCloudDownload,
  cilCloudUpload,
  cilCommentSquare,
  cilContrast,
  cilDollar,
  cilEnvelopeOpen,
  cilFeaturedPlaylist,
  cilFile,
  cilFilter,
  cilInbox,
  cilList,
  cilLockLocked,
  cilMenu,
  cilMoon,
  cilOptions,
  cilPencil,
  cilPeople,
  cilPlus,
  cilReload,
  cilSave,
  cilSearch,
  cilSettings,
  cilShieldAlt,
  cilSpeedometer,
  cilSquare,
  cilSun,
  cilSwapVertical,
  cilTask,
  cilTrash,
  cilUser,
  cilUserFemale,
  cilViewColumn,
  cilX,
  cilXCircle
} from '@coreui/icons';
import CIcon from '@coreui/icons-vue';
import CoreuiVue from '@coreui/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import { installSessionGuard } from '@/contracts/sessionGuard';
import { bootCana, exposeCanaTestHooks } from '@/data/db';
import registerSW from '@/data/pwa';
import { bindOnlineReplay } from '@/data/sync';
import '@/modules/index';
import registerShellToolbarWidgets from '@/shell/registerShellWidgets';

import App from './App.vue';
import { configureAppOperations } from './contracts/appOperations';
import router from './router';

// Fail loudly at boot when the bundled OAS lacks an operation the shell relies on (JUM-780).
configureAppOperations();
registerShellToolbarWidgets();

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(CoreuiVue);

// Only the icons the shell + dashboard actually use — the full set stays in the template catalog.
app.provide('icons', {
  cilMenu,
  cilSpeedometer,
  cilSun,
  cilMoon,
  cilContrast,
  cilBell,
  cilList,
  cilEnvelopeOpen,
  cilArrowBottom,
  cilArrowTop,
  cilOptions,
  cilCloudDownload,
  cilPeople,
  cilUser,
  cilUserFemale,
  cilSettings,
  cilTask,
  cilCommentSquare,
  cilDollar,
  cilFile,
  cilShieldAlt,
  cilLockLocked,
  cilCalendar,
  cilPlus,
  cilPencil,
  cilTrash,
  cilCheck,
  cilX,
  cilSearch,
  cilReload,
  cilViewColumn,
  cilSave,
  cilCloudUpload,
  cilInbox,
  cilSwapVertical,
  cilCheckCircle,
  cilXCircle,
  cilFeaturedPlaylist,
  cilFilter,
  cilSquare,
  cibFacebook,
  cibTwitter,
  cibLinkedin,
  cibGoogle,
  cibCcMastercard,
  cibCcVisa,
  cibCcStripe,
  cibCcPaypal,
  cibCcApplePay,
  cibCcAmex,
  cifUs,
  cifBr,
  cifIn,
  cifFr,
  cifEs,
  cifPl
});
app.component('CIcon', CIcon);

// Global session guard: any non-auth 401 from the SDK expires the session and
// lands on /login from any page (not only /profile).
installSessionGuard(router);

const boot = await bootCana();
exposeCanaTestHooks();
if (boot === 'ok') {
  bindOnlineReplay();
  registerSW();
}
app.provide('canaBoot', boot);
app.mount('#app');
