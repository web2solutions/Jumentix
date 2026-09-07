// Customs Value = Value of the goods + Freight + Insurance + Customs Expenses
// Import tax rate = 60% if the customs value is greater than US$ 50.00.

// If the customs value is equal to or less than US$ 50.00, the import tax rate is 20%.

const dollarToRealExchangeRate = 5.0004 // Example of exchange rate (1 USD = 5.2 BRL)
const orderValue = 22.52 // Example of merchandise value
const freight = 20 // Example of freight value
const insurance = 0 // Example of insurance value
const customsOtherTaxes = 0 // Example of customs expenses value

const customsValue = orderValue + freight + insurance + customsOtherTaxes
const aliquotaImportacao = customsValue > 50 ? 0.6 : 0.2
const customsValueInReais = customsValue * dollarToRealExchangeRate
const ImportTax = customsValueInReais * aliquotaImportacao

console.log('Order value: USD', orderValue)
console.log('Freight: USD', freight)
console.log('Insurance: USD', insurance)
console.log('Customs Expenses: USD', customsOtherTaxes)
console.log(
  'Customs Value (Value of the goods + Freight + Insurance + Customs Expenses): USD',
  customsValue,
)
console.log('Customs Value in Reais: R$', customsValueInReais.toFixed(2))
console.log('------FEDERAL TAXES-----------')
console.log('')
console.info('Import Tax in Reais: R$', ImportTax.toFixed(2))
console.info('Import Tax in USD: USD', (ImportTax / dollarToRealExchangeRate).toFixed(2))
console.log('')
console.log('---------START CALCULATE STATE TAX-----------')

// Base Cálculo = (Valor Aduaneiro + Imposto de Importação) / (1 - Alíquota ICMS)
// ICMS = base * alíquota ICMS
const stateRate = 0.17 // Example of state rate (17%)
const base = (customsValueInReais + ImportTax) / (1 - stateRate)
const icms = base * stateRate

console.log('Base de Cálculo: R$', base.toFixed(2))
console.log('')
console.log('----------STATE ICMS TAX------------')
console.info('ICMS in Reais: R$', icms.toFixed(2))
console.info('ICMS in USD: $', (icms / dollarToRealExchangeRate).toFixed(2))
