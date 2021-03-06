const { nonEmptyArray } = require('../util/validators')

const { db } = require('../util/admin')

const cleanChampion = ({ attributes, avatar, image, name, order, uid }) => {
  return {
    ...(uid && { uid }),
    ...(name && { name }),
    ...(image && { image }),
    ...(avatar && { avatar }),
    ...(order && { order }),
    ...(attributes && { attributes }),
  }
}

const championFromDocumentSnapshot = doc =>
  doc.exists && cleanChampion({ uid: doc.id, ...doc.data() })

const getChampion = uid => db.doc(`/champions/${uid}`).get().then(championFromDocumentSnapshot)

const findByName = name =>
  db
    .collection('champions')
    .where('name', '==', name)
    .get()
    .then(data => data.docs.map(championFromDocumentSnapshot))

const findByNameIn = names =>
  db
    .collection('champions')
    .where('name', 'in', names)
    .get()
    .then(data => data.docs.map(championFromDocumentSnapshot))

const getChampions = () =>
  db
    .collection('champions')
    .orderBy('order')
    .get()
    .then(data => data.docs.map(championFromDocumentSnapshot))

const fetchChampion = async ({ params: { championId } }, res) => {
  console.log(championId)
  try {
    const champion = await getChampion(championId)
    console.dir(champion, { depth: 2, colors: true })
    return res.json(champion)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.code })
  }
}

const createMapByKey = (array, key) => array.reduce((agg, obj) => ((agg[obj[key]] = obj), agg), {})

const fetchChampions = async (req, res) => {
  try {
    const championData = await getChampions()
    return res.json(
      championData,
      // championMap: createMapByKey(championData, 'uid'),
      // championNameMap: createMapByKey(championData, 'name'),
    )
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.code })
  }
}

const createChampion = async ({ body }, res) => {
  try {
    if (!body) return res.status(400).json({ body: 'Post body must not be empty' })
    // TODO any other required fields?

    const newChampion = cleanChampion(body)
    const { id: uid } = await db.collection('champions').add(newChampion)

    return res.json({ uid, ...newChampion })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.code })
  }
}

const updateMultipleChampions = async ({ body: champions }, res) => {
  if (!nonEmptyArray(champions))
    return res.status(400).json({ error: 'At least one champion is required' })

  const output = {}
  await Promise.all(
    champions.map((body, index) =>
      updateChampion(body).then(
        response => (output[response.uid || `Entry:${index}`] = response.error || 'updated'),
      ),
    ),
  )
  return res.json(output)
}

const updateOneChampion = async ({ body }, res) => {
  const response = await updateChampion(body)
  return res.status(response.error ? 500 : 200).json(response)
}

const updateChampion = async ({ uid, ...updates }) => {
  try {
    if (!uid) return { error: { uid: 'A champion uid is required' } }
    if (!updates) return { error: { body: 'Put body must not be empty' } }

    const champion = await db.doc(`/champions/${uid}`).get()
    if (!champion.exists) return { error: { uid: `No champion found with the uid: ${uid}` } }

    if (updates.attributes) {
      const oldAttributes = champion.data().attributes
      const newAttributes = { ...oldAttributes, ...updates.attributes }
      updates.attributes = newAttributes
    }

    const cleaned = cleanChampion(updates)
    console.dir(cleaned, { depth: 2, colors: true })
    await db.doc(`/champions/${uid}`).update(cleaned)
    return { uid, ...cleaned }
  } catch (err) {
    console.error(err)
    return { error: err.code }
  }
}

Object.assign(exports, {
  createChampion,
  fetchChampion,
  fetchChampions,
  findByName,
  findByNameIn,
  getChampion,
  getChampions,
  updateMultipleChampions,
  updateOneChampion,
})
