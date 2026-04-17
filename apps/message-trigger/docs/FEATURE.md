# Features

## DistributeTimeCondition


Está feature tem como base o objetivo de nao ter o pico inicial das 8 horas causados pelos steps de condition, agendando para a primeira hora do inicio.

Para ativar essa feature é preciso preencher a variavel de ambiente:

**FEATURE_DISTRIBUTE_TIME_CONDITION**

### Como devemos preencher?

AUTOMACAO_ID:PRIMEIRA_PORCENTAGEM:SEGUNDA_PORCENTAGEM:TERCEIRA_PORCENTAGEM

ou

ALL:PRIMEIRA_PORCENTAGEM:SEGUNDA_PORCENTAGEM:TERCEIRA_PORCENTAGEM

A diferença é que podemos ativar para apenas uma automacao ou para todas.

_Exemplo: ALL:15:45:70_

#### Como fica na pratica?

Primeiro será validado o AUTOMACAO_ID ou ALL caso seja possivel será verificado as porcentagens.

- Se for menor igual que a **PRIMEIRA_PORCENTAGEM (15)** não acrescentará nada.

- Se for maior que a **PRIMEIRA_PORCENTAGEM (15)** e menor igual que **SEGUNDA_PORCENTAGEM (45)** acresentará 1 hora.

- Se for maior que **SEGUNDA_PORCENTAGEM (45)** e menor igual que a **TERCEIRA_PORCENTAGEM (70)** acresentará 2 horas.

- Se for maior **TERCEIRA_PORCENTAGEM (70)** acresentará 3 horas.

___

## EmailPullSenderFeature


Está feature é para comecar o envio de forma cadenciada, onde atualmente o topic para qual é enviado é configurado como PUSH, ou seja enviando a mensagem sem um controle de vasao. A feature permite que a mensagem seja enviada para um outro topico onde este deve ser configurado PULL para um servico terceiro realizar o consumo e envio da mensagem.

### Como devemos preencher?

| ENVS | Description |
|:---:|---|
| FEATURE_EMAIL_PULL_SENDER | Responsavel para indicar em qual contexto sera executada a feature, podendo ser ALL para todas automacoes ou o nome da automacao. |
| TOPIC_FEATURE_EMAIL_PULL_SENDER | Para qual topico sera enviado  |
|  |  |

#### Como fica na pratica?

Caso FEATURE_EMAIL_PULL_SENDER seja validada para a mensagem em questao, será enviada para o Topico TOPIC_FEATURE_EMAIL_PULL_SENDER com os filtros: 

priority: EmailPriority
type: 'pull-sender'

Com isso fica disponivel para o servico terceiro consumir esta fila.