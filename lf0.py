import json
import boto3



def lambda_handler(event, context):

    #Create an instance of the Lex Run-time client
    client = boto3.client('lex-runtime')

    #Extract the user message
    userMsg = event["messages"]["message"]


    #Send message to Lex
    response = client.post_text(
    botName='concierge',
    botAlias='Concierge',
    userId="123",
    inputText=userMsg
    )

    #Return Message to Client
    return {
        'statusCode': 200,
        'body': json.dumps(response['message'])
    }
    
