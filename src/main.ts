import * as core from '@actions/core'

import {z} from 'zod'
import fs from 'fs'
import fetch from 'node-fetch'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', {required: true})
    const courseId = z.number().parse(core.getInput('course', {required: true}))
    // const assignment = z
    //   .number()
    //   .parse(core.getInput('assignment', {required: true}))
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
    const response = await fetch(`${url}/api/v1/courses`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const courses = courseSchema.parse(await response.json())

    // Check given course exists
    const course = courses.find(x => x.id === courseId)
    if (course === undefined)
      throw new Error(`Could not find course with id ${courseId}`)

    core.info(`Found course with id ${course.id}: ${course.name}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
