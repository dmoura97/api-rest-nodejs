import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { knex } from '../database'
import { checkSessionIdExits } from '../middlewares/check-session-id-exists'

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, response) => {
    console.log(`[${request.method}] ${request.url}`)
  })

  app.get(
    '/',
    {
      preHandler: [checkSessionIdExits],
    },
    async (request, response) => {
      const { sessionId } = request.cookies

      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select()

      return {
        transactions,
      }
    },
  )

  app.get(
    '/summary',
    {
      preHandler: [checkSessionIdExits],
    },
    async (request) => {
      const { sessionId } = request.cookies

      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', {
          as: 'amount',
        })
        .first()

      return { summary }
    },
  )

  app.get(
    '/:id',
    {
      preHandler: [checkSessionIdExits],
    },
    async (request, res) => {
      const getTransactionParams = z.object({
        id: z.string().uuid(),
      })

      const { id } = getTransactionParams.parse(request.params)

      const { sessionId } = request.cookies

      const transaction = await knex('transactions')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      if (!transaction) {
        return res.status(404).send({
          message: 'Transaction not found',
        })
      }

      return transaction
    },
  )

  app.post('/', async (req, res) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    })

    const { title, amount, type } = createTransactionBodySchema.parse(req.body)

    let sessionId = req.cookies.sessionId

    if (!sessionId) {
      sessionId = crypto.randomUUID()

      res.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      })
    }

    await knex('transactions').insert({
      id: crypto.randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    })

    return res.status(201).send()
  })
}
