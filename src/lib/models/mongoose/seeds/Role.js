export default {
  schema: 'Role',
  plant: 'never', //  once - always - never
  data: [
    // adptive
    // =======>
    {
      name: 'Child',
      label: 'Child',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Son',
          label: 'Son',
          canDelete: false
        },
        {
          name: 'Daugther',
          label: 'Daugther',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Grand Child',
      label: 'Grand Child',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Grand Daughter',
          label: 'Grand Daughter',
          canDelete: false
        },
        {
          name: 'Grand Son',
          label: 'Grand Son',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Grand Parent',
      label: 'Grand Parent',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Grand Father',
          label: 'Grand Father',
          canDelete: false
        },
        {
          name: 'Grand Mother',
          label: 'Grand Mother',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Parent',
      label: 'Parent',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Father',
          label: 'Father',
          canDelete: false
        },
        {
          name: 'Mother',
          label: 'Mother',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Parent Sibling',
      label: 'Parent Sibling',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Aunt',
          label: 'Aunt',
          canDelete: false
        },
        {
          name: 'Uncle',
          label: 'Uncle',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Parent Sibling Child',
      label: 'Parent Sibling Child',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Cousin',
          label: 'Cousin',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: "Sibling's Child",
      label: "Sibling's Child",
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [
        {
          name: 'Nephew',
          label: 'Nephew',
          canDelete: false
        },
        {
          name: 'Niece',
          label: 'Niece',
          canDelete: false
        }
      ],
      canDelete: false
    },
    {
      name: 'Relative',
      label: 'Relative',
      type: 'Family', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },

    // ==========
    {
      name: 'Spouse',
      label: 'Spouse',
      type: 'Couple', // Family,  Couple, Social, Service, Couple
      sub_roles: [
        {
          name: 'Ex-Husband',
          label: 'Ex-Husband',
          canDelete: false
        },
        {
          name: 'Ex-Wife',
          label: 'Ex-Wife',
          canDelete: false
        },
        {
          name: 'Husband',
          label: 'Husband',
          canDelete: false
        },
        {
          name: 'Wife',
          label: 'Wife',
          canDelete: false
        },
        {
          name: 'Partner',
          label: 'Parter',
          canDelete: false
        },
        {
          name: 'Ex-Partner',
          label: 'Ex-Parter',
          canDelete: false
        }
      ],
      canDelete: false
    },

    // ==========
    {
      name: 'Agency Admin',
      label: 'Agency Admin',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Case Worker',
      label: 'Case Worker',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Case Worker Manager',
      label: 'Case Worker Manager',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Counselor',
      label: 'Counselor',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Doctor',
      label: 'Doctor',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Sub Contractor',
      label: 'Sub Contractor',
      type: 'Service', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },

    // social
    {
      name: 'Boyfriend',
      label: 'Boyfriend',
      type: 'Social', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Friend',
      label: 'Friend',
      type: 'Social', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Girlfriend',
      label: 'Girlfriend',
      type: 'Social', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Neighbor',
      label: 'Neighbor',
      type: 'Social', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },

    {
      name: 'Sponser',
      label: 'Sponser',
      type: 'Other', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Tutor',
      label: 'Tutor',
      type: 'Other', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    },
    {
      name: 'Volunteer',
      label: 'Volunteer',
      type: 'Other', // Family,  Couple, Social, Service
      sub_roles: [],
      canDelete: false
    }
  ]
}
