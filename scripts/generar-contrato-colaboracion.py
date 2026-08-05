# -*- coding: utf-8 -*-
"""Genera el borrador revisado del contrato de colaboración en .docx."""
import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(10.5)
style.paragraph_format.space_after = Pt(6)
style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY


def para(text='', bold=False, size=None, align=None, space_before=None, italic=False, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor(*color)
    if align is not None:
        p.alignment = align
    if space_before:
        p.paragraph_format.space_before = Pt(space_before)
    return p


def clause(number, title):
    p = doc.add_paragraph()
    run = p.add_run('%s. %s' % (number, title))
    run.bold = True
    run.font.size = Pt(11)
    p.paragraph_format.space_before = Pt(12)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    return p


def bullet(text, level=0):
    p = doc.add_paragraph(text, style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.8 + 0.6 * level)
    p.paragraph_format.space_after = Pt(3)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return p


def numbered(text):
    p = doc.add_paragraph(text, style='List Number')
    p.paragraph_format.left_indent = Cm(0.8)
    p.paragraph_format.space_after = Pt(3)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return p


GREY = (0x66, 0x66, 0x66)
RED = (0xB0, 0x1C, 0x1C)

# ---------------------------------------------------------------- Aviso
para('BORRADOR PENDIENTE DE REVISIÓN LETRADA — NO FIRMAR EN ESTE ESTADO',
     bold=True, size=10, align=WD_ALIGN_PARAGRAPH.CENTER, color=RED)
para('Versión 2 · incorpora las observaciones de la revisión funcional de 05/08/2026. '
     'Los apartados entre corchetes [ ] deben completarse. Este documento no ha sido '
     'validado por un abogado; la Ley 12/1992 del Contrato de Agencia (cláusula 2ª y 10ª) '
     'requiere criterio profesional antes de su uso.',
     size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)

para()

# ---------------------------------------------------------------- Título
para('CONTRATO MERCANTIL DE COLABORACIÓN COMERCIAL',
     bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
para('Y LICENCIA LIMITADA DE USO DE SOFTWARE',
     bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
para('ESTRICTAMENTE CONFIDENCIAL', bold=True, size=9,
     align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)

para()
para('En Plasencia (Cáceres), a ____ de ________________ de ________',
     align=WD_ALIGN_PARAGRAPH.CENTER)

# ---------------------------------------------------------------- Reunidos
para('REUNIDOS', bold=True, size=11.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=14)

para('De una parte, LA EMPRESA: SINGERGIA PRISMA, S.L., con NIF B24784902 y domicilio '
     'social en Plaza Mayor, 2, 2º Pta. A — 10600 Plasencia (Cáceres). Representada en '
     'este acto por D./Dña. ________________________________________, con DNI '
     '____________________, en calidad de Apoderado/a.')

para('De otra parte, EL COLABORADOR: ________________________________________ '
     '(nombre y apellidos o razón social), con DNI/NIF ____________________ y domicilio '
     'a efectos de notificaciones en ________________________________________________. '
     'Correo electrónico a efectos de notificaciones y firma electrónica: '
     '________________________________________. Teléfono móvil: ____________________. '
     'Representado en este acto por D./Dña. ________________________________________, '
     'con DNI ____________________.')

para('Ambas partes se reconocen mutuamente capacidad legal suficiente para obligarse y, '
     'a tal efecto:')

# ---------------------------------------------------------------- Manifiestan
para('MANIFIESTAN', bold=True, size=11.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12)

numbered('Que LA EMPRESA se dedica a la comercialización e intermediación de productos y '
         'servicios energéticos (electricidad y gas natural), siendo titular exclusiva de '
         'la aplicación informática App ZINERGIA, diseñada para la comparación y '
         'optimización de tarifas de comercializadoras.')
numbered('Que EL COLABORADOR dispone de la organización, experiencia y medios propios '
         'necesarios para realizar labores de promoción comercial.')
numbered('Que ambas partes desean establecer un marco de colaboración comercial, sujeto a '
         'las siguientes:')

para('CLÁUSULAS', bold=True, size=11.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12)

# ---------------------------------------------------------------- 1
clause('PRIMERA', 'Objeto del Contrato')
para('El objeto del presente contrato es la prestación de servicios de mediación, '
     'promoción y formalización de contratos de suministro de energía por parte de EL '
     'COLABORADOR a favor de LA EMPRESA. Asimismo, se regula la cesión del derecho de uso '
     'estrictamente temporal y limitado de la App ZINERGIA para el desarrollo de dicha '
     'actividad.')
para('Forman parte inseparable de este contrato los siguientes anexos, que las partes '
     'declaran conocer y aceptar:')
bullet('Anexo I — Condiciones económicas y comisiones.')
bullet('Anexo II — Política de Decomisiones.')
bullet('Anexo III — Acuerdo de facturación por el destinatario (autofacturación).')
bullet('Anexo IV — Acuerdo de encargo del tratamiento de datos personales.')

# ---------------------------------------------------------------- 2
clause('SEGUNDA', 'Naturaleza de la Relación (Independencia)')
para('El presente contrato tiene naturaleza estrictamente mercantil. EL COLABORADOR '
     'actuará con total independencia organizativa, asumiendo el riesgo y ventura de sus '
     'operaciones. No existe subordinación, ni relación laboral alguna entre LA EMPRESA y '
     'EL COLABORADOR o sus empleados o subcontratados. EL COLABORADOR será el único '
     'responsable del cumplimiento de sus obligaciones fiscales, laborales y de Seguridad '
     'Social.')
para('[NOTA PARA REVISIÓN LETRADA — la actividad descrita (promoción continuada y '
     'retribuida de operaciones por cuenta de LA EMPRESA) puede quedar sujeta a la Ley '
     '12/1992, del Contrato de Agencia, con independencia de la denominación que las '
     'partes den al contrato. De ser así, resultarían aplicables con carácter imperativo, '
     'entre otros, el régimen de preaviso del art. 25 y la indemnización por clientela del '
     'art. 28, que no es renunciable anticipadamente. Debe decidirse si se asume ese '
     'régimen y se ajustan en consecuencia las cláusulas OCTAVA y NOVENA, o si se '
     'reconfigura la relación.]', size=9, color=RED)

# ---------------------------------------------------------------- 3
clause('TERCERA', 'Propiedad Intelectual, Uso de la App ZINERGIA y Secreto Empresarial')
para('Titularidad. La App ZINERGIA, sus algoritmos de cálculo, bases de datos, código '
     'fuente y diseño son propiedad exclusiva e intransferible de SINGERGIA PRISMA, S.L. y '
     'constituyen un Secreto Empresarial protegido por ley.')
para('Licencia de Uso. LA EMPRESA otorga a EL COLABORADOR un perfil de acceso personal, '
     'intransferible y revocable. Este acceso se concede única y exclusivamente para '
     'generar propuestas y comparar tarifas orientadas a cerrar contratos gestionados a '
     'través de LA EMPRESA.')
para('Prohibiciones Expresas. Queda terminantemente prohibido:')
bullet('Utilizar la App ZINERGIA para asesorar, comparar tarifas o cerrar ventas con '
       'comercializadoras ajenas al portfolio de LA EMPRESA o para uso independiente.')
bullet('La extracción de datos, scraping, copias de pantalla automatizadas o ingeniería '
       'inversa.')
bullet('Ceder, alquilar o compartir las credenciales de acceso con terceros.')
para('Infracción. Cualquier uso de la App fuera de lo estipulado supondrá un '
     'incumplimiento grave, conllevando la resolución inmediata del contrato, el bloqueo '
     'del acceso y el derecho de LA EMPRESA a exigir la indemnización correspondiente por '
     'daños y perjuicios y competencia desleal.')

# ---------------------------------------------------------------- 4
clause('CUARTA', 'Operativa y Calidad de las Ventas')
para('Para que una venta sea validada y devengue comisiones, EL COLABORADOR deberá '
     'cumplir con las políticas de LA EMPRESA, aportando a través de la App ZINERGIA:')
bullet('Contrato de suministro firmado por el titular.')
bullet('DNI, NIE o CIF en vigor del titular y, en su caso, acreditación de la '
       'representación con la que actúa el firmante.')
bullet('Factura de suministro con una antigüedad máxima de TRES (3) meses.')
bullet('Los consentimientos y documentos precontractuales exigidos por la cláusula QUINTA.')
para('Queda prohibida la realización de promesas o garantías a los clientes que no figuren '
     'en los anexos oficiales de las comercializadoras. Las simulaciones de ahorro '
     'generadas por la App ZINERGIA tienen carácter meramente orientativo y no vinculante, '
     'debiendo EL COLABORADOR informar de ello al cliente.')
para('EL COLABORADOR no alojará documentación de clientes fuera de la App ZINERGIA, '
     'conforme a la cláusula OCTAVA y al Anexo IV.')

# ---------------------------------------------------------------- 5 (nueva)
clause('QUINTA', 'Obligaciones precontractuales frente al cliente')
para('EL COLABORADOR se obliga a cumplir la normativa sectorial vigente en materia de '
     'contratación y protección del consumidor de energía y, en particular, el Real '
     'Decreto 88/2026, de 11 de febrero, por el que se aprueba el Reglamento general de '
     'suministro, comercialización y agregación de energía eléctrica.')
para('A tal efecto, y con carácter previo a la tramitación de cualquier alta '
     'correspondiente a clientes domésticos o trabajadores autónomos, así como a sus '
     'renovaciones, EL COLABORADOR deberá recabar del cliente, exclusivamente a través de '
     'los cauces habilitados en la App ZINERGIA y de forma que quede acreditada cada fase '
     'del proceso:')
bullet('El consentimiento expreso, libre, específico e informado para la solicitud de una '
       'oferta personalizada.')
bullet('La aceptación del contrato de asesoramiento energético.')
bullet('La aceptación de la información sobre el tratamiento de sus datos personales.')
bullet('Cuando proceda, el consentimiento del titular para la consulta de sus datos de '
       'suministro y consumo en el Sistema de Información de Puntos de Suministro (SIPS).')
para('Queda expresamente prohibida la realización de llamadas comerciales no solicitadas, '
     'así como cualquier práctica de contratación no consentida por el titular.')
para('El incumplimiento de esta cláusula impedirá la validación de la venta y el devengo '
     'de comisión, sin perjuicio de lo previsto en la cláusula SÉPTIMA.')

# ---------------------------------------------------------------- 6
clause('SEXTA', 'Remuneración Económica (Comisiones) y Facturación')
para('Como contraprestación, EL COLABORADOR percibirá las comisiones estipuladas en el '
     'Anexo I vigente en cada momento (Comisiones de Captación y/o Cartera), aplicables '
     'solo a contratos efectivamente validados y activados por la distribuidora.')
para('La liquidación será mensual. A las cantidades devengadas se les aplicarán los '
     'impuestos (IVA) y retenciones (IRPF) que correspondan por ley.')
para('LA EMPRESA podrá actualizar las tarifas y comisiones (Anexo I) notificándolo con 7 '
     'días hábiles de antelación. Dicha actualización no afectará a las comisiones ya '
     'devengadas por contratos activados con anterioridad a su entrada en vigor.')
para('Autofacturación. Las partes acuerdan expresamente que LA EMPRESA expedirá, en nombre '
     'y por cuenta de EL COLABORADOR, las facturas correspondientes a las comisiones '
     'devengadas, conforme al artículo 5 del Reglamento por el que se regulan las '
     'obligaciones de facturación (Real Decreto 1619/2012). Los términos de dicho acuerdo, '
     'incluido el procedimiento de aceptación de cada factura, constan en el Anexo III.')
para('EL COLABORADOR se obliga a mantener actualizados en la App ZINERGIA sus datos '
     'fiscales y de pago. LA EMPRESA no vendrá obligada a liquidar cantidad alguna '
     'mientras dichos datos estén incompletos o sean incorrectos.')

# ---------------------------------------------------------------- 7
clause('SÉPTIMA', 'Decomisiones, Penalizaciones y Fraude')
para('Decomisiones (bajas y rechazos). No se liquidarán, o se detraerán si ya hubieran '
     'sido abonados, los importes correspondientes a contratos que resulten en baja '
     'anticipada, no lleguen a activarse, incurran en impago o carezcan de la '
     'documentación exigida.')
para('El régimen aplicable —plazos, porcentajes de devolución, fecha de cómputo y '
     'supuestos exceptuados— es el recogido en el Anexo II, Política de Decomisiones, que '
     'refleja las condiciones que las comercializadoras aplican a LA EMPRESA. Se aplicarán '
     'las siguientes reglas:')
bullet('Las cantidades a detraer se compensarán con las liquidaciones posteriores. De '
       'resultar saldo pendiente a la extinción del contrato, será exigible directamente.')
bullet('LA EMPRESA no reclamará decomisiones transcurridos [___] meses desde la fecha de '
       'baja del contrato afectado.')
bullet('EL COLABORADOR dispondrá de [___] días naturales desde la notificación para '
       'formular alegaciones y aportar prueba. Estimadas las alegaciones, se revertirá el '
       'ajuste.')
bullet('Toda decomisión quedará registrada en la App ZINERGIA con indicación del contrato '
       'afectado, motivo, fecha e importe, y será consultable por EL COLABORADOR.')
para('Fraude (ventas no consentidas). La suplantación de identidad o la contratación de '
     'productos no solicitados constituye infracción muy grave. LA EMPRESA aplicará una '
     'penalización de 150 € por contrato fraudulento, más 75 € en concepto de gastos de '
     'verificación y gestión. EL COLABORADOR asumirá además cualquier sanción impuesta por '
     'organismos públicos (CNMC, AEPD u otros) derivada de su mala praxis.')
para('Si el fraude supera el 5 % de la producción, o las ventas incompletas el 15 %, LA '
     'EMPRESA podrá resolver el contrato de forma inmediata.')

# ---------------------------------------------------------------- 8
clause('OCTAVA', 'Confidencialidad y Protección de Datos')
para('Las partes se someten al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 '
     '(LOPDGDD). EL COLABORADOR tratará por cuenta de LA EMPRESA los datos personales a '
     'los que acceda en ejecución de este contrato, en condición de Encargado del '
     'Tratamiento, obligándose a guardar el más estricto secreto profesional, que '
     'subsistirá tras la extinción del contrato.')
para('Las condiciones del encargo exigidas por el artículo 28.3 del RGPD —objeto, '
     'duración, naturaleza y finalidad del tratamiento, categorías de datos e interesados, '
     'instrucciones documentadas, medidas de seguridad, régimen de subencargados, '
     'asistencia en el ejercicio de derechos y en la notificación de brechas, devolución o '
     'supresión de los datos y sometimiento a auditorías— constan en el Anexo IV.')
para('EL COLABORADOR no podrá crear bases de datos paralelas, ni alojar documentación de '
     'clientes en servidores, dispositivos, cuentas de correo o servicios en la nube no '
     'autorizados, debiendo destruir o devolver la información a la finalización del '
     'contrato.')

# ---------------------------------------------------------------- 9 (nueva)
clause('NOVENA', 'Titularidad de la cartera de clientes')
para('Los clientes captados o gestionados por EL COLABORADOR en ejecución del presente '
     'contrato son clientes de LA EMPRESA a todos los efectos. La asignación de cartera '
     'registrada en la App ZINERGIA tiene carácter organizativo y no confiere a EL '
     'COLABORADOR derecho de propiedad alguno sobre dichos clientes ni sobre sus datos.')
para('Extinguido el contrato por cualquier causa, la cartera permanecerá en LA EMPRESA, '
     'que podrá reasignarla. Los traspasos de cartera entre colaboradores requerirán '
     'aprobación de LA EMPRESA y quedarán registrados con indicación del motivo.')
para('[NOTA PARA REVISIÓN LETRADA — valórese la conveniencia de incorporar un pacto de no '
     'captación de clientela posterior a la extinción. De optarse por un pacto de '
     'limitación de la competencia, deberá respetar los límites de los artículos 20 y 21 '
     'de la Ley 12/1992: forma escrita, duración máxima de dos años y limitación a la zona '
     'geográfica y al grupo de clientes y productos objeto del contrato.]',
     size=9, color=RED)

# ---------------------------------------------------------------- 10
clause('DÉCIMA', 'Duración y Resolución')
para('El contrato tendrá una duración de UN (1) AÑO desde su firma, prorrogándose '
     'tácitamente por periodos anuales salvo preaviso fehaciente de cualquiera de las '
     'partes con [___] días de antelación.')
para('[NOTA PARA REVISIÓN LETRADA — de resultar aplicable la Ley 12/1992, el preaviso '
     'mínimo del contrato devenido por tiempo indefinido es de un mes por cada año de '
     'vigencia, con un máximo de seis meses (art. 25.2). El plazo de quince días de la '
     'versión anterior debe revisarse.]', size=9, color=RED)
para('Serán causas de resolución: el mutuo acuerdo; el incumplimiento de las obligaciones '
     'de las partes, en especial las relativas al uso de la App ZINERGIA (cláusula '
     'TERCERA), a las obligaciones precontractuales frente al cliente (cláusula QUINTA), '
     'al fraude (cláusula SÉPTIMA) y a la protección de datos (cláusula OCTAVA); y la '
     'declaración de concurso de acreedores de cualquiera de las partes.')
para('A la finalización del contrato se bloqueará de forma inmediata el acceso a la App '
     'ZINERGIA. Ello no afectará al devengo de las comisiones correspondientes a contratos '
     'ya activados, que se liquidarán en sus términos, ni a las decomisiones pendientes '
     'conforme al Anexo II.')

# ---------------------------------------------------------------- 11 (nueva)
clause('UNDÉCIMA', 'Firma electrónica y comunicaciones')
para('Las partes acuerdan que el presente contrato, sus anexos y cuantas comunicaciones se '
     'deriven de él puedan formalizarse mediante firma electrónica, y reconocen '
     'expresamente su validez, eficacia y fuerza probatoria conforme al Reglamento (UE) '
     '910/2014 (eIDAS) y a la Ley 6/2020, de 11 de noviembre.')
para('Las partes aceptan como prueba de la firma el documento firmado y el certificado de '
     'evidencias asociado, que recoge la identidad del firmante, la fecha y hora, y los '
     'datos técnicos de la operación. LA EMPRESA conservará dichas evidencias durante la '
     'vigencia del contrato y los plazos de prescripción aplicables.')
para('Las comunicaciones entre las partes se dirigirán a las direcciones de correo '
     'electrónico designadas en el encabezamiento, que las partes reconocen como válidas a '
     'efectos de notificación.')

# ---------------------------------------------------------------- 12
clause('DUODÉCIMA', 'Ley Aplicable y Jurisdicción')
para('El presente contrato se regirá por la legislación española. Para la resolución de '
     'cualquier controversia que pudiera derivarse, las partes, con renuncia expresa a '
     'cualquier otro fuero que pudiera corresponderles, se someten a la jurisdicción y '
     'competencia de los Juzgados y Tribunales de la ciudad de Plasencia.')

para('Y en prueba de conformidad, firman el presente contrato en el lugar y fecha '
     'indicados en el encabezamiento.', space_before=12)

# ---------------------------------------------------------------- Firmas
doc.add_paragraph()
table = doc.add_table(rows=2, cols=2)
table.autofit = True
left = table.cell(0, 0).paragraphs[0]
left.add_run('POR LA EMPRESA').bold = True
table.cell(0, 0).add_paragraph('SINGERGIA PRISMA, S.L.')
right = table.cell(0, 1).paragraphs[0]
right.add_run('POR EL COLABORADOR').bold = True
table.cell(0, 1).add_paragraph(' ')

table.cell(1, 0).add_paragraph('\n\n')
table.cell(1, 0).add_paragraph('Fdo.: ______________________________')
table.cell(1, 1).add_paragraph('\n\n')
table.cell(1, 1).add_paragraph('Fdo.: ______________________________')

doc.add_page_break()

# ---------------------------------------------------------------- Guía de anexos
para('ANEXOS PENDIENTES DE ELABORACIÓN', bold=True, size=12,
     align=WD_ALIGN_PARAGRAPH.CENTER)
para('Esta página no forma parte del contrato. Es una nota de trabajo: retírese antes de '
     'la firma.', size=9, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY, italic=True)

para('Anexo I — Condiciones económicas y comisiones', bold=True, space_before=10)
para('Importes de captación y cartera por comercializadora, segmento y banda de consumo. '
     'Se generará desde los planes de comisión configurados en la aplicación, de modo que '
     'el anexo y lo que la aplicación liquida no puedan divergir.')

para('Anexo II — Política de Decomisiones', bold=True, space_before=8)
para('Plantilla ya redactada. Pendiente de completar con las condiciones que cada '
     'comercializadora aplica a LA EMPRESA: ventana de decomisión, regla de devolución y '
     'fecha de cómputo.')

para('Anexo III — Acuerdo de autofacturación', bold=True, space_before=8)
para('Consentimiento expreso a que LA EMPRESA expida las facturas en nombre de EL '
     'COLABORADOR, procedimiento y plazo de aceptación o rechazo de cada factura, y '
     'duración del acuerdo. Exigido por el artículo 5 del Real Decreto 1619/2012.')

para('Anexo IV — Encargo del tratamiento de datos', bold=True, space_before=8)
para('Contenido mínimo del artículo 28.3 del RGPD.')

para('Documentos de cliente (distintos de este contrato)', bold=True, space_before=10)
para('Exigidos por el Real Decreto 88/2026 y referidos en la cláusula QUINTA. Los firma el '
     'cliente, no el colaborador: consentimiento expreso para la solicitud de oferta '
     'personalizada, contrato de asesoramiento energético, e información sobre el '
     'tratamiento de datos personales.')

para('Campos a marcar en DocuSeal', bold=True, space_before=10)
para('Al subir el documento, arrastre un campo sobre cada línea de puntos: fecha del '
     'encabezamiento; nombre, DNI, domicilio, correo y teléfono del colaborador; nombre y '
     'DNI de los representantes; plazos de las cláusulas SÉPTIMA y DÉCIMA; y las dos '
     'casillas de firma del pie.', size=9, color=GREY)

doc.save(sys.argv[1])
print('OK', sys.argv[1])
