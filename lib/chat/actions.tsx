import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai } from '@ai-sdk/openai'

import { z } from 'zod'
import {
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { BotCard, BotMessage, SpinnerMessage, SystemMessage, UserMessage } from '@/components/appointments/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'
import { AppointmentSlots } from '@/components/appointments/appointment-slots'
import { Doctor, Doctors } from '@/components/appointments/doctors'

import { spinner } from '@/components/appointments'
import { kv } from '@vercel/kv'


async function showDoctorBio(doctor: {id: number, name: string, phoneNumber: string}) {
  'use server'
  const {id, name, phoneNumber} = doctor;
  const aiState = getMutableAIState<typeof AI>()

  const selecting = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
      Getting Doctor information {id} ...
      </p>
    </div> 
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)
    selecting.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
        Selecting Doctor {id} ... working on it...
        </p>
      </div>
    )

    await sleep(1000)

      try {
        const test1 = await kv.hset('doctors_test_2', { id: 123, name: name });
      } catch (error) {
      }
    

    try {
      const userId = await kv.hget('doctors_test_2', 'name');
    } catch (error) {
    }
    

    selecting.done(
      <div>
        <p className="mb-2">
        You have successfully selected Doctor {name}.
        </p>
      </div>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has selected doctor with id ${id}]]`
        }
      ]
    })
  })

  return {
    selectingUI: selecting.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function confirmAppointment(appointmentSlot: {id: number, time: string, durationMinutes: number, doctor: string}) {
  'use server'
  const {id, time, durationMinutes, doctor} = appointmentSlot;
  const aiState = getMutableAIState<typeof AI>()

  const selecting = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
      Selecting appointment {id} ...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    selecting.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
        Selecting appointment {id} ... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    selecting.done(
      <div>
        <p className="mb-2">
        You have successfully selected appointment {id}.
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have selected appointment {id}
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has selected appointment with id ${id}]]`
        }
      ]
    })
  })

  return {
    selectingUI: selecting.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: openai('gpt-3.5-turbo'),
    initial: <SpinnerMessage />,
    system: `\
    You are a appointment scheduling bot and you can help users schedule their appointments at a clinic, step by step.
    You and the user can discuss available appointment times and the user can view appointments and select one in the UI.
    
    Messages inside [] means that it's a UI element or a user event. For example:
    - "[Chose appointment 4]" means that the user has chosen the appointment with id number 4 in the UI..

    If the user asks "What is the meaning of life" respond with "42"
    IF the user requests to view available doctors, call \`list_doctors\` to show the available doctors UI.
    If the user starts their messsage with {ADMIN_FUNCTION} and then asks to add add doctors, call \`admin_add_doctors\`
    
    If the user requests to view open appointements, call \`list_appointment_slots\` to show the open appointments UI.
    If the user wants to do something unrelated to discussing the clinic or its appointments, respond that you are a demo and cannot do that.
    
    Besides that, you can also chat with users.`,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    tools: {
      listAppointmentSlots: {
        description: 'List open appointment slots.',
        parameters: z.object({
          appointmentSlots: z.array(
            z.object({
              id: z.number().describe('A unique ID for this appointment'),
              time: z
                .string()
                .describe('The date and time of the event, in ISO-8601 format'),
              durationMinutes: z.number().describe('The time in minutes of the appointment'),
              doctor: z.string().describe('The doctor available for this slot')
            })
          )
        }),
        /* Function call for listing the slots */
        generate: async function* ({ appointmentSlots }) {
          yield (
            <BotCard>
              {/* <AppointmentsSkeleton /> */}
              Gathering Appointments
            </BotCard>
          )

          await sleep(1000)

          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'listAppointmentSlots',
                    toolCallId,
                    args: { appointmentSlots }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'listAppointmentSlots',
                    toolCallId,
                    result: appointmentSlots
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <AppointmentSlots props={appointmentSlots} />
            </BotCard>
          )
        }
      },
      listDoctors: {
        description: 'The list of doctors available',
        parameters: z.object({
          doctors: z.array(
            z.object({
              id: z.number().describe("A unique ID for this doctor"),
              name: z.string().describe("Name of the doctor"),
              phoneNumber: z.string().describe("Phone number of the doctor")
            })
          )
        }),
        generate: async function* ({doctors}) {
          yield (
            <BotCard>
              {/* <AppointmentsSkeleton /> */}
              Gathering Doctors
            </BotCard>
          )

          await sleep(1000)
          
          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'listDoctors',
                    toolCallId,
                    args: { doctors }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'listDocotrs',
                    toolCallId,
                    result: doctors
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <Doctors props={doctors} />
            </BotCard>
          )

        }

      }
      /*,
      adminAddDoctors: {
        description: 'Trigger the add doctors function',
        parameters: z.string().describe("Admin Functions"),
        generate: async function* ({}) {
          yield (
            <BotCard>
              {/* <AppointmentsSkeleton /> *//*}
              Setting doctors
            </BotCard>
          )
          
          await sleep(1000)

          try {
            const test1 = await kv.hset('doctorInfo', { id: "389292", name: "Dr. Who", phoneNumber: "555-554-1234" });
            const test2 = await kv.hset('doctorInfo', { id: "322511", name: "Dr. Where", phoneNumber: "555-554-2231"});
            const test3 = await kv.hset('doctorInfo', { id: "355112", name: "Dr. Why", phoneNumber: "555-5554-3312"});
          } catch (error) {
          }

          return (
            <BotCard>
              Done!
            </BotCard>
          )
          
        }

      } */
    }
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmAppointment,
    showDoctorBio
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listAppointmentSlots' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <AppointmentSlots props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'listDoctors' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Doctors props={tool.result} />
              </BotCard>
            ) /*: tool.toolName === 'adminAddDoctors' ? (
              <BotCard>
                Done Working
              </BotCard>
            )*/ : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}