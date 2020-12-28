export default {
  schema: 'Good',
  plant: 'once', //  once - always - never
  data: [
    {
      name: 'Good name',
      type: 'Product',
      class: 'Class name',
      factor: [
        {
          medical: 3,
          age: 10
        }
      ],
      amount: 10.55,
      unity: 'Hours',
      unityCost: 5.49,
      unityPrice: 10.55,
      discount: 1.53,
      quantity: 1
    },
    {
      name: 'AIRS License',
      type: 'Product',
      class: 'AIRS / JumentiX Usage',
      factor: [
        {
          medical: 3,
          age: 10
        }
      ],
      amount: 450.0,
      unity: 'Unity',
      unityCost: 150.0,
      unityPrice: 450.0,
      discount: 0,
      quantity: 1
    },
    {
      name: '2014 FAC Support	',
      type: 'Service',
      class: 'AIRS Usage Charge',
      factor: [
        {
          medical: 3,
          age: 10
        }
      ],
      amount: 250.0,
      unity: 'Hours',
      unityCost: 100.0,
      unityPrice: 125.0,
      discount: 0,
      quantity: 1
    }
  ]
}
