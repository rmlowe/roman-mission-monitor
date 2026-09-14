const recognizers = [
  {
    milestone: 'hga_deploy',
    status: 'complete',
    matches: (text) =>
      /(high[- ]gain antenna[^.!?]{0,160}(has |have )?(successfully )?deployed|antenna deployment[^.!?]{0,160}(concluded|completed))/i.test(text),
    title: 'High-gain antenna deployed',
  },
  {
    milestone: 'aperture_cover_deploy',
    status: 'complete',
    matches: (text) =>
      /(deployable aperture cover[^.!?]{0,180}(successfully completed|was successfully deployed|has successfully deployed|deployment[^.!?]{0,50}completed)|aperture cover[^.!?]{0,180}(successfully completed|deployment[^.!?]{0,50}completed))/i.test(text),
    title: 'Deployable aperture cover deployed',
  },
  {
    milestone: 'coronagraph_power_on',
    status: 'complete',
    matches: (text) =>
      /(coronagraph instrument[^.!?]{0,140}(has been successfully activated|has successfully powered on|has powered on|was successfully activated)|has successfully activated[^.!?]{0,100}coronagraph instrument)/i.test(text),
    title: 'Coronagraph Instrument powered on',
  },
  {
    milestone: 'wfi_power_on',
    status: 'complete',
    matches: (text) =>
      /((wide field instrument|\bWFI\b)[^.!?]{0,140}(has been successfully activated|has successfully powered on|has powered on|was successfully activated)|has successfully activated[^.!?]{0,100}(wide field instrument|\bWFI\b))/i.test(text),
    title: 'Wide Field Instrument powered on',
  },
  {
    milestone: 'mcc2',
    status: 'not_required',
    matches: (text) =>
      /(second|#2)[^.!?]{0,50}mid-course correction[^.!?]{0,180}(not required|not needed|unnecessary)/i.test(text),
    title: 'Second mid-course correction not required',
  },
  {
    milestone: 'mcc2',
    status: 'complete',
    matches: (text) =>
      /(second|#2)[^.!?]{0,50}mid-course correction[^.!?]{0,180}(was successfully completed|has been completed|completed successfully|burn[^.!?]{0,40}(completed|concluded))/i.test(text),
    title: 'Second mid-course correction complete',
  },
  {
    milestone: 'l2',
    status: 'complete',
    matches: (text) =>
      /(orbit insertion[^.!?]{0,120}(completed|successful)|entered[^.!?]{0,80}(L2|second Lagrange point)|arrived at[^.!?]{0,40}L2)/i.test(text),
    title: 'L2 orbit insertion complete',
  },
  {
    milestone: 'first_look',
    status: 'complete',
    matches: (text) =>
      /\bfirst(?:[- ]look)? (?:images|observations) (?:have been |were |are |successfully )?(?:released|published)\b/i.test(text),
    title: 'First-look images released',
  },
  {
    milestone: 'science',
    status: 'complete',
    matches: (text) =>
      /\bscience operations (?:have (?:begun|started)|began|started|are underway)\b/i.test(text),
    title: 'Science operations begun',
  },
]

// Prefer a missed automatic update over interpreting a plan or denial as evidence.
// Evaluate sentences independently, and never join a headline to article text.
const uncertain = /\b(?:will|would|could|should|may|might|must|not|never|no|cannot|can['’]t|hasn['’]t|haven['’]t|hadn['’]t|isn['’]t|wasn['’]t|weren['’]t|didn['’]t|won['’]t|if|unless|expected|planned|scheduled|anticipated|aims?|hopes?|before|until|whether)\b/i

export function recognize(item) {
  const sentences = [item.title, item.text].flatMap(value =>
    (value ?? '').split(/[.!?;\n]+/).map(sentence => sentence.trim()).filter(Boolean),
  )
  return recognizers
    .filter((rule) => sentences.some(sentence => {
      // "Not required" is a positive assertion for this particular state.
      const assertion = rule.status === 'not_required'
        ? sentence.replace(/\bnot (?:required|needed)\b/gi, 'unnecessary')
        : sentence
      return !uncertain.test(assertion) && rule.matches(sentence)
    }))
    .map((rule) => ({
      id: `rss:${rule.milestone}:${item.url}`,
      milestone: rule.milestone,
      status: rule.status,
      publishedAt: item.publishedAt,
      title: rule.title,
      summary: item.title,
      source: item.url,
      sourceType: 'nasa-roman-rss',
      recognizerVersion: 2,
    }))
}

// Old RSS science events may mean only first-image release. Preserve seed events
// and recognitions produced with the separated milestone rules.
export function discardLegacyScienceEvents(events) {
  return events.filter(event => !(event.sourceType === 'nasa-roman-rss' &&
    event.milestone === 'science' && event.recognizerVersion !== 2))
}
