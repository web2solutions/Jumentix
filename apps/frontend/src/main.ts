import { createApp } from 'vue';
import { createPinia } from 'pinia';

import CoreuiVue from '@coreui/vue';
import CIcon from '@coreui/icons-vue';
import {
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
} from '@coreui/icons';
import router from './router';
import { installSessionGuard } from '@/contracts/sessionGuard';
import App from './App.vue';
import { configureAppOperations } from './contracts/appOperations';
import '@/modules/index';
import { registerShellToolbarWidgets } from '@/shell/registerShellWidgets';

// Fail loudly at boot when the bundled OAS lacks an operation the shell relies on (JUM-780).
configureAppOperations();
registerShellToolbarWidgets();

const app = createApp(App);

app.use(createPinia());
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

app.mount('#app');
