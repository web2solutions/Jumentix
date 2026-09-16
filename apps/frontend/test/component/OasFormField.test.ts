import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';

import OasFormField from '@/components/OasFormField.vue';
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { fieldDescriptors } from '@/contracts/formSchema';
import { setLocale } from '@/i18n';

import { freshSession, mountWithShell } from './support';

/**
 * JUM-776/780/781 — the OAS-driven field renders a contract label (x-label →
 * title → humanized name), the description as help text, emits on `input`
 * (so autofill and password managers work — JUM-781 finding 12), and enum /
 * reference controls show labels while emitting values.
 */
describe('OasFormField', () => {
  beforeEach(() => {
    freshSession();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the x-label of the active locale and the description as help text', async () => {
    expect.hasAssertions();
    const [firstName] = fieldDescriptors('RequestCreateUser').filter((d) => d.name === 'firstName');
    const wrapper = mountWithShell(OasFormField, { props: { descriptor: firstName, modelValue: '' } });
    expect(wrapper.find('label').text()).toBe('First name *');
    expect(wrapper.find('.form-text').text()).toBe('User\'s first name');
    setLocale('pt-BR');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('label').text()).toBe('Nome *');
    wrapper.unmount();
  });

  it('humanizes a property with no x-label and no title', () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(OasFormField, {
      props: { descriptor: { name: 'customerSegmentCode', type: 'string', required: false }, modelValue: '' }
    });
    expect(wrapper.find('label').text()).toBe('Customer segment code');
    wrapper.unmount();
  });

  it('emits update:modelValue on every input event, capped by maxLength', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(OasFormField, {
      props: {
        descriptor: {
          name: 'username', type: 'string', required: true, maxLength: 12
        },
        modelValue: ''
      }
    });
    const input = wrapper.find('input');
    expect(input.attributes('maxlength')).toBe('12');
    await input.setValue('zoe');
    expect(wrapper.emitted('update:modelValue')?.[0]).toStrictEqual(['zoe']);
    wrapper.unmount();
  });

  it('shows the validation message with role=alert instead of the help text', () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(OasFormField, {
      props: {
        descriptor: {
          name: 'username', type: 'string', required: true, description: 'help'
        },
        modelValue: '',
        invalid: 'Username is required.'
      }
    });
    expect(wrapper.find('[role="alert"]').text()).toBe('Username is required.');
    expect(wrapper.find('.form-text').exists()).toBe(false);
    wrapper.unmount();
  });
});

describe('SearchableEnumInput', () => {
  beforeEach(() => {
    freshSession();
  });

  it('displays the label of the selected value and emits the value when a label is typed', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(SearchableEnumInput, {
      props: {
        id: 'org',
        modelValue: 'org-1',
        options: [{ value: 'org-1', label: 'ACME' }, { value: 'org-2', label: 'Umbrella' }]
      }
    });
    const input = wrapper.find('input');
    expect((input.element as HTMLInputElement).value).toBe('ACME');
    await input.setValue('Umbrella');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['org-2']);
    expect(wrapper.findAll('option').map((o) => o.attributes('value'))).toStrictEqual(['ACME', 'Umbrella']);
    wrapper.unmount();
  });

  it('passes plain enum text through so validation can reject non-members', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(SearchableEnumInput, {
      props: { id: 'type', modelValue: 'CPF', options: ['CPF', 'RG'] }
    });
    await wrapper.find('input').setValue('XX');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['XX']);
    wrapper.unmount();
  });

  it('resolves a typed label to the option value when options arrive late', async () => {
    expect.hasAssertions();
    const wrapper = mountWithShell(SearchableEnumInput, {
      props: {
        id: 'org',
        modelValue: '',
        options: [] as Array<{ value: string; label: string }>
      }
    });
    await wrapper.find('input').setValue('ACME');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['ACME']);
    await wrapper.setProps({
      options: [{ value: 'org-1', label: 'ACME' }, { value: 'org-2', label: 'Umbrella' }]
    });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['org-1']);
    wrapper.unmount();
  });
});
