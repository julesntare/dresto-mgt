import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: "D'Resto Management API",
      version: '1.0.0',
      description: 'API documentation for restaurant management system',
      contact: {
        name: 'API Support',
        email: 'support@dresto.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'STAFF'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            image: { type: 'string' },
            isAvailable: { type: 'boolean' },
            categoryId: { type: 'string' },
            category: { $ref: '#/components/schemas/Category' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            menuItems: {
              type: 'array',
              items: { $ref: '#/components/schemas/MenuItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Table: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            number: { type: 'string', example: 'T1' },
            capacity: { type: 'integer', example: 4 },
            location: { type: 'string', example: 'Main Hall' },
            status: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNumber: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            orderType: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] },
            tableId: { type: 'string' },
            table: { $ref: '#/components/schemas/Table' },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'],
            },
            totalAmount: { type: 'number' },
            notes: { type: 'string' },
            userId: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            orderItems: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            quantity: { type: 'integer' },
            price: { type: 'number' },
            orderId: { type: 'string' },
            menuItemId: { type: 'string' },
            menuItem: { $ref: '#/components/schemas/MenuItem' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
