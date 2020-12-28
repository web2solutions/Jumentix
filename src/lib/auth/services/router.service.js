export async function start(webapp, application) {
  let error = false
  try {
    Object.keys(application.config.app.oAuth).forEach((key) => {
      if (application.config.app.oAuth[key].enabled) {
        require(`../passports/${key}.passport`)
      }
    })
    return { error }
  } catch (e) {
    // statements
    console.log(e)
    return { error: e }
  }
}
