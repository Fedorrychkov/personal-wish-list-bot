import { CustomizationDocument } from 'src/entities'

export type CustomizationDto = {
  id?: CustomizationDocument['id']
  title?: CustomizationDocument['title']
  patternName?: CustomizationDocument['patternName']
}
