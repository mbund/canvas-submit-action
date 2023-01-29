import * as core from '@actions/core'

import {z} from 'zod'
import fs from 'fs'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', {required: true})
    const url = z
      .string()
      .url()
      .parse(core.getInput('url', {required: true}))
    const filepath = core.getInput('file', {required: true})
    const filestat = fs.statSync(filepath)
    if (!filestat.isFile()) throw new Error(`File ${filepath} is not a file`)
    const file = {
      size: filestat.size,
      bytes: fs.readFileSync(filepath).toString('binary')
    }

    core.info(`Uploading ${file.size} bytes to ${url}`)

    // Enumerate all courses
    const courseSchema = z.array(
      z.object({
        id: z.number(),
        name: z.string()
      })
    )
    const courses = courseSchema.parse(
      (
        await fetch('https://osu.instructure.com/api/v1/courses', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ).json()
    )
    core.info(`Found ${courses}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
