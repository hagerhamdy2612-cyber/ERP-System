const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });


// Import models
const User = require('../models/User');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const SalesOrder = require('../models/SalesOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const ProductionOrder = require('../models/ProductionOrder');
const Attendance = require('../models/Attendance');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await Customer.deleteMany({});
    await SalesOrder.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await ProductionOrder.deleteMany({});
    await Attendance.deleteMany({});

    console.log('Cleared existing data');

    // Create users
    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@erp.com',
        password: 'password123',
        role: 'admin',
        department: 'HR'
      },
      {
        name: 'John Manager',
        email: 'manager@erp.com',
        password: 'password123',
        role: 'manager',
        department: 'Manufacturing'
      },
      {
        name: 'Jane Employee',
        email: 'employee@erp.com',
        password: 'password123',
        role: 'employee',
        department: 'Sales'
      },
      {
        name: 'Mike HR',
        email: 'hr@erp.com',
        password: 'password123',
        role: 'manager',
        department: 'HR'
      },
      {
        name: 'Sarah Sales',
        email: 'sales@erp.com',
        password: 'password123',
        role: 'employee',
        department: 'Sales'
      }
    ]);

    console.log('Created users');

    // Create employees
    const employees = await Employee.create([
      {
        employeeId: 'EMP0001',
        user: users[0]._id,
        position: 'System Administrator',
        department: 'HR',
        hireDate: new Date('2020-01-15'),
        salary: 80000
      },
      {
        employeeId: 'EMP0002',
        user: users[1]._id,
        position: 'Production Manager',
        department: 'Manufacturing',
        hireDate: new Date('2019-03-20'),
        salary: 75000,
        manager: null
      },
      {
        employeeId: 'EMP0003',
        user: users[2]._id,
        position: 'Sales Representative',
        department: 'Sales',
        hireDate: new Date('2021-06-10'),
        salary: 55000,
        manager: users[1]._id
      },
      {
        employeeId: 'EMP0004',
        user: users[3]._id,
        position: 'HR Manager',
        department: 'HR',
        hireDate: new Date('2018-09-05'),
        salary: 70000
      },
      {
        employeeId: 'EMP0005',
        user: users[4]._id,
        position: 'Sales Manager',
        department: 'Sales',
        hireDate: new Date('2020-11-15'),
        salary: 65000
      }
    ]);

    console.log('Created employees');

    // Create suppliers
    const suppliers = await Supplier.create([
      {
        name: 'ABC Materials Inc.',
        contactPerson: 'John Smith',
        email: 'john@abcmaterials.com',
        phone: '+1-555-0101',
        address: {
          street: '123 Industrial Ave',
          city: 'Detroit',
          state: 'MI',
          zipCode: '48201',
          country: 'USA'
        },
        rating: 4.5,
        paymentTerms: 'Net 30'
      },
      {
        name: 'XYZ Components Ltd.',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@xyzcomponents.com',
        phone: '+1-555-0102',
        address: {
          street: '456 Manufacturing Blvd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'USA'
        },
        rating: 4.2,
        paymentTerms: 'Net 15'
      }
    ]);

    console.log('Created suppliers');

    // Create products
    const products = await Product.create([
      {
        name: 'Steel Rods',
        sku: 'SR-001',
        description: 'High-grade steel rods for manufacturing',
        category: 'raw-material',
        unit: 'pieces',
        currentStock: 1000,
        minStockLevel: 200,
        maxStockLevel: 2000,
        unitCost: 25.50,
        supplier: suppliers[0]._id
      },
      {
        name: 'Aluminum Sheets',
        sku: 'AS-002',
        description: 'Premium aluminum sheets',
        category: 'raw-material',
        unit: 'sheets',
        currentStock: 500,
        minStockLevel: 100,
        maxStockLevel: 1000,
        unitCost: 45.00,
        supplier: suppliers[0]._id
      },
      {
        name: 'Electronic Components',
        sku: 'EC-003',
        description: 'Various electronic components',
        category: 'raw-material',
        unit: 'units',
        currentStock: 2000,
        minStockLevel: 500,
        maxStockLevel: 5000,
        unitCost: 12.75,
        supplier: suppliers[1]._id
      },
      {
        name: 'Finished Widget A',
        sku: 'WA-001',
        description: 'High-quality widget type A',
        category: 'final-product',
        unit: 'units',
        currentStock: 150,
        minStockLevel: 50,
        maxStockLevel: 500,
        unitCost: 85.00,
        sellingPrice: 120.00
      },
      {
        name: 'Finished Widget B',
        sku: 'WB-002',
        description: 'Premium widget type B',
        category: 'final-product',
        unit: 'units',
        currentStock: 75,
        minStockLevel: 25,
        maxStockLevel: 300,
        unitCost: 95.00,
        sellingPrice: 140.00
      }
    ]);

    console.log('Created products');

    // Create customers
    const customers = await Customer.create([
      {
        name: 'TechCorp Solutions',
        email: 'orders@techcorp.com',
        phone: '+1-555-0201',
        company: 'TechCorp Solutions',
        customerType: 'business',
        creditLimit: 50000,
        address: {
          street: '789 Business Park Dr',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'USA'
        }
      },
      {
        name: 'Manufacturing Plus',
        email: 'contact@mfgplus.com',
        phone: '+1-555-0202',
        company: 'Manufacturing Plus Inc.',
        customerType: 'business',
        creditLimit: 75000,
        address: {
          street: '321 Industrial Way',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
          country: 'USA'
        }
      },
      {
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+1-555-0203',
        customerType: 'individual',
        creditLimit: 5000
      }
    ]);

    console.log('Created customers');

    // Create sales orders
    const salesOrders = await SalesOrder.create([
      {
        orderNumber: 'SO0001',
        customer: customers[0]._id,
        items: [
          {
            product: products[3]._id,
            quantity: 50,
            unitPrice: 120.00,
            total: 6000.00
          }
        ],
        subtotal: 6000.00,
        tax: 600.00,
        total: 6600.00,
        status: 'confirmed',
        orderDate: new Date('2024-01-15'),
        salesRep: employees[2]._id
      },
      {
        orderNumber: 'SO0002',
        customer: customers[1]._id,
        items: [
          {
            product: products[4]._id,
            quantity: 25,
            unitPrice: 140.00,
            total: 3500.00
          }
        ],
        subtotal: 3500.00,
        tax: 350.00,
        total: 3850.00,
        status: 'pending',
        orderDate: new Date('2024-01-20'),
        salesRep: employees[4]._id
      }
    ]);

    console.log('Created sales orders');

    // Create purchase orders
    const purchaseOrders = await PurchaseOrder.create([
      {
        orderNumber: 'PO0001',
        supplier: suppliers[0]._id,
        items: [
          {
            product: products[0]._id,
            quantity: 500,
            unitPrice: 25.50,
            total: 12750.00
          }
        ],
        subtotal: 12750.00,
        tax: 1275.00,
        total: 14025.00,
        status: 'received',
        orderDate: new Date('2024-01-10'),
        receivedDate: new Date('2024-01-12'),
        purchaser: employees[0]._id
      },
      {
        orderNumber: 'PO0002',
        supplier: suppliers[1]._id,
        items: [
          {
            product: products[2]._id,
            quantity: 1000,
            unitPrice: 12.75,
            total: 12750.00
          }
        ],
        subtotal: 12750.00,
        tax: 1275.00,
        total: 14025.00,
        status: 'ordered',
        orderDate: new Date('2024-01-18'),
        expectedDelivery: new Date('2024-01-25'),
        purchaser: employees[0]._id
      }
    ]);

    console.log('Created purchase orders');

    // Create production orders
    const productionOrders = await ProductionOrder.create([
      {
        orderNumber: 'PO0001',
        product: products[3]._id,
        quantity: 50,
        status: 'completed',
        startDate: new Date('2024-01-16'),
        endDate: new Date('2024-01-18'),
        materials: [
          {
            product: products[0]._id,
            quantity: 100,
            unitCost: 25.50
          },
          {
            product: products[2]._id,
            quantity: 200,
            unitCost: 12.75
          }
        ],
        salesOrder: salesOrders[0]._id
      }
    ]);

    console.log('Created production orders');

    // Create attendance records
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Attendance.create([
      {
        employee: employees[0]._id,
        date: today,
        checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
        checkOut: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0),
        workingHours: 8,
        status: 'present'
      },
      {
        employee: employees[1]._id,
        date: today,
        checkIn: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30),
        status: 'present'
      },
      {
        employee: employees[2]._id,
        date: yesterday,
        checkIn: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 9, 15),
        checkOut: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 18, 0),
        workingHours: 8.75,
        overtime: 0.75,
        status: 'present'
      }
    ]);

    console.log('Created attendance records');

    console.log('✅ Seed data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Users: ${users.length}`);
    console.log(`- Employees: ${employees.length}`);
    console.log(`- Products: ${products.length}`);
    console.log(`- Suppliers: ${suppliers.length}`);
    console.log(`- Customers: ${customers.length}`);
    console.log(`- Sales Orders: ${salesOrders.length}`);
    console.log(`- Purchase Orders: ${purchaseOrders.length}`);
    console.log(`- Production Orders: ${productionOrders.length}`);
    console.log('\n🔑 Login credentials:');
    console.log('Admin: admin@erp.com / password123');
    console.log('Manager: manager@erp.com / password123');
    console.log('Employee: employee@erp.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
