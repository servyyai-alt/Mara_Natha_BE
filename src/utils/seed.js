import 'dotenv/config'
import mongoose from 'mongoose'

import User from '../models/User.js'
import Product from '../models/Product.js'
import Category from '../models/Category.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Maranatha'

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const categories = [
  { name: 'Electronics', slug: slugify('Electronics'), description: 'Gadgets, phones, laptops and more', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400' },
  { name: 'Fashion', slug: slugify('Fashion'), description: 'Clothing, shoes and accessories', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400' },
  { name: 'Home & Kitchen', slug: slugify('Home & Kitchen'), description: 'Everything for your home', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400' },
  { name: 'Sports', slug: slugify('Sports'), description: 'Sports and outdoor equipment', image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400' },
  { name: 'Books', slug: slugify('Books'), description: 'Books across all genres', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400' },
  { name: 'Beauty', slug: slugify('Beauty'), description: 'Beauty and personal care', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400' },
]

const sampleProducts = [
  {
    name: 'Wireless Noise Cancelling Headphones',
    description: 'Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio quality.',
    price: 4999,
    originalPrice: 7999,
    category: 'Electronics',
    brand: 'AudioPro',
    stock: 25,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', public_id: 'sample1' }],
    ratings: 4.5,
    numReviews: 124,
    specifications: [
      { key: 'Battery Life', value: '30 Hours' },
      { key: 'Connectivity', value: 'Bluetooth 5.0' },
      { key: 'Noise Cancellation', value: 'Active' },
    ],
  },
  {
    name: 'Smart Watch Pro Series',
    description: 'Feature-packed smartwatch with health monitoring, GPS, and 7-day battery life.',
    price: 8999,
    originalPrice: 12999,
    category: 'Electronics',
    brand: 'TechWear',
    stock: 15,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', public_id: 'sample2' }],
    ratings: 4.3,
    numReviews: 89,
  },
  {
    name: 'Premium Cotton T-Shirt',
    description: 'Soft 100% organic cotton t-shirt available in multiple colors. Comfortable everyday wear.',
    price: 799,
    originalPrice: 1299,
    category: 'Fashion',
    brand: 'StyleCo',
    stock: 100,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', public_id: 'sample3' }],
    ratings: 4.1,
    numReviews: 256,
  },
  {
    name: 'Stainless Steel Water Bottle',
    description: 'Double-wall insulated water bottle. Keeps drinks cold for 24 hours and hot for 12 hours.',
    price: 1199,
    originalPrice: 1799,
    category: 'Sports',
    brand: 'HydroFlask',
    stock: 50,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', public_id: 'sample4' }],
    ratings: 4.7,
    numReviews: 312,
  },
  {
    name: 'Non-Stick Cookware Set',
    description: 'Professional grade 5-piece non-stick cookware set. Dishwasher safe and oven safe up to 400°F.',
    price: 3499,
    originalPrice: 5999,
    category: 'Home & Kitchen',
    brand: 'KitchenPro',
    stock: 20,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1584990347449-e7e0c28e1c0e?w=400', public_id: 'sample5' }],
    ratings: 4.4,
    numReviews: 178,
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Extra thick 6mm non-slip yoga mat. Eco-friendly TPE material with carrying strap.',
    price: 1499,
    originalPrice: 2499,
    category: 'Sports',
    brand: 'ZenFit',
    stock: 40,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1601925228604-2f9c00a3fe05?w=400', public_id: 'sample6' }],
    ratings: 4.6,
    numReviews: 445,
  },
]

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
      Product.deleteMany(),
      Category.deleteMany(),
    ])
    console.log('🗑️  Cleared existing data')

    // Create admin user (pass plaintext — the pre('save') hook hashes it)
    const admin = await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@maranatha.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
    })
    console.log(`👤 Admin created: ${admin.email}`)

    // Create sample user
    await User.create({
      name: 'Test User',
      email: 'user@maranatha.com',
      password: 'User@123',
      role: 'user',
    })
    console.log('👤 Sample user created: user@maranatha.com')

    // Create categories
    const createdCategories = await Category.insertMany(categories)
    console.log(`📁 ${createdCategories.length} categories created`)

    // Create products
    const now = Date.now()
    const productsWithSlugs = sampleProducts.map((p, i) => ({
      ...p,
      slug: slugify(p.name) ? `${slugify(p.name)}-${now}-${i}` : `${now}-${i}`,
    }))
    const createdProducts = await Product.insertMany(productsWithSlugs)
    console.log(`📦 ${createdProducts.length} products created`)

    console.log('\n🎉 Database seeded successfully!\n')
    console.log('Admin credentials:')
    console.log(`  Email   : ${process.env.ADMIN_EMAIL || 'admin@maranatha.com'}`)
    console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}`)
    console.log('\nSample user:')
    console.log('  Email   : user@maranatha.com')
    console.log('  Password: User@123')

    process.exit(0)
  } catch (err) {
    console.error('❌ Seed error:', err.message)
    process.exit(1)
  }
}

seed()
