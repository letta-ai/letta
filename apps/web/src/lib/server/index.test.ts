import { streamedArgumentsParserGenerator } from '$web/server/index';

describe('streamedArgumentsParserGenerator', () => {
  it('should parse streamed messages', async () => {
    const jsonToStream = JSON.stringify({
      message: 'Of course , I would love to',
      test: true,
    });

    const generator = streamedArgumentsParserGenerator();

    const reconstructedObject: Record<string, any> = {};

    jsonToStream.split('').forEach((char) => {
      generator.reader(char, (data) => {
        Object.entries(data).forEach(([key, value]) => {
          if (!reconstructedObject[key]) {
            reconstructedObject[key] = value;
          } else {
            reconstructedObject[key] += value;
          }
        });
      });
    });

    expect(reconstructedObject).toEqual({
      message: 'Of course , I would love to',
      test: 'true',
    });
  });
});
