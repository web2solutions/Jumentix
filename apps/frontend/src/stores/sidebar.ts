import { defineStore } from 'pinia';
import { ref } from 'vue';

const useSidebarStore = defineStore('sidebar', () => {
  const visible = ref<boolean | undefined>(undefined);
  const unfoldable = ref(false);

  const toggleVisible = (value?: boolean) => {
    visible.value = value ?? !visible.value;
  };

  const toggleUnfoldable = () => {
    unfoldable.value = !unfoldable.value;
  };

  return {
    visible,
    unfoldable,
    toggleVisible,
    toggleUnfoldable
  };
});

export default useSidebarStore;
