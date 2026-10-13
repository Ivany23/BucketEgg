import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, MinLength } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { PortugueseValidationPipe, translateValidationMessage } from './validation-pt.js';

class Sample {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  @Max(480)
  serviceMins?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  outletIds?: string[];

  @IsOptional()
  @MaxLength(5, { message: 'Mensagem personalizada.' })
  code?: string;
}

describe('mensagens de validação em português', () => {
  it('traduz as mensagens por omissão do class-validator', () => {
    expect(translateValidationMessage('name must be longer than or equal to 2 characters')).toBe('«name» tem de ter pelo menos 2 caracteres.');
    expect(translateValidationMessage('geofenceRadiusM must not be less than 10')).toBe('«geofenceRadiusM» não pode ser inferior a 10.');
    expect(translateValidationMessage('property role should not exist')).toBe('O campo «role» não é permitido.');
    expect(translateValidationMessage('status must be one of the following values: ACTIVE, REJECTED')).toBe(
      '«status» tem de ser um destes valores: ACTIVE, REJECTED.',
    );
    expect(translateValidationMessage('each value in outletIds must be a UUID')).toBe('Cada valor de «outletIds» tem de ser um identificador válido.');
    expect(translateValidationMessage('items.0.quantity must not be less than 0.001')).toBe('«items.0.quantity» não pode ser inferior a 0.001.');
  });

  it('mantém mensagens já em português ou desconhecidas', () => {
    expect(translateValidationMessage('A palavra-passe deve ter pelo menos 8 caracteres.')).toBe('A palavra-passe deve ter pelo menos 8 caracteres.');
    expect(translateValidationMessage('something unexpected happened')).toBe('something unexpected happened');
  });

  it('o pipe devolve 400 com as mensagens traduzidas', async () => {
    const pipe = new PortugueseValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const run = () =>
      pipe.transform({ name: 'x', serviceMins: 500, outletIds: ['nope'], code: 'longo demais', extra: 1 }, { type: 'body', metatype: Sample });
    await expect(run()).rejects.toBeInstanceOf(BadRequestException);
    const messages = await run().catch((e: BadRequestException) => (e.getResponse() as { message: string[] }).message);
    expect(messages).toEqual(
      expect.arrayContaining([
        '«name» tem de ter pelo menos 2 caracteres.',
        '«serviceMins» não pode ser superior a 480.',
        'Cada valor de «outletIds» tem de ser um identificador válido.',
        'Mensagem personalizada.',
        'O campo «extra» não é permitido.',
      ]),
    );
  });
});
