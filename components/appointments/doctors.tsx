'use client'

import { useActions, useUIState } from 'ai/rsc'

import type { AI } from '@/lib/chat/actions'
import { useState } from 'react'

export interface Doctor extends Record<string, any> {
    id: number
    name: string
    phoneNumber: string
}

export function Doctors({props: doctors }: {props: Doctor[]}) {
    const [, setMessages] = useUIState<typeof AI>()
    const [selectingUI, setSelectingUI] = useState<null | React.ReactNode>(null)
    const { showDoctorBio } = useActions()

    return (
        <div>
            {selectingUI ? (<div className="mt-4 text-zinc-200">{selectingUI}</div>) :
                (<div className="flex flex-row gap-2 overflow-y-scroll text-sm sm:flex-col">
                    {doctors.map(doctor => (
                        <button
                            key={doctor.id}
                            className="flex cursor-pointer flex-row gap-2 rounded-lg bg-zinc-800 text-left hover:bg-zinc-700 sm:w-85"
                            onClick={async () => {
                                const response = await showDoctorBio(doctor)
                                setSelectingUI(response.selectingUI)

                                // Insert a new system message to the UI.
                                setMessages((currentMessages: any) => [
                                    ...currentMessages,
                                    response.newMessage
                                ])
                            }}
                        >
                            <div className="flex flex-col">
                                {doctor.name}
                            </div>
                            <div className="ml-auto flex flex-col">
                                {doctor.phoneNumber}
                            </div>
                        </button>
                    ))}
                </div>)}
        </div>
    )
}