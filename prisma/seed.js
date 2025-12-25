/* global process */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default settings
  const defaultSettings = await prisma.settings.upsert({
    where: {
      id: 'default'
    },
    update: {},
    create: {
      id: 'default',
      jetStatusIn: true,
      jetEmail: 'online.shop@pbpf.bg',
      jetId: '',
      jetPurcent: 1.40,
      jetVnoskiDefault: 12,
      jetCardIn: true,
      jetPurcentCard: 1.00,
      jetCount: '',
      jetMinprice: 150,
      jetEur: 0,
    },
  })

  console.log('✅ Default settings created:', defaultSettings)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
