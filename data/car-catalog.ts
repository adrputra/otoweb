export const carCatalog = {
  Toyota: ['Avanza', 'Camry', 'Fortuner', 'Innova Zenix', 'Raize', 'Rush'],
  Honda: ['Brio', 'CR-V', 'HR-V', 'Civic'],
  Mitsubishi: ['Xpander', 'Pajero Sport', 'Outlander'],
  Suzuki: ['XL7', 'Ertiga', 'Jimny'],
  Hyundai: ['Creta', 'Ioniq 5', 'Palisade'],
} as const

export const brands = Object.keys(carCatalog)
export const commonFeatures = ['Sunroof', 'Kamera 360', 'Apple CarPlay', 'Android Auto', 'Cruise Control', 'Blind Spot Monitor', 'Kunci Serep', 'Servis Rutin']
