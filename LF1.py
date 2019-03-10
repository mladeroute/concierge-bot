import json
import math
import dateutil.parser
import datetime
import time
import os
import logging
from botocore.vendored import requests

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
images = []

MAX_SUGGESTIONS = 10
SUGGESTION_LENGTH = 3

""" --- Helpers to build responses which match the structure of the necessary dialog actions --- """

"""
def get_slots(intent_request)

Retrieves and returns the slot data from the event sent to LF1
"""
def get_slots(intent_request):
    return intent_request['currentIntent']['slots']

"""
elicit_slot(session_attributes, intent_name, slots, slot_to_elicit, message)


Elicits the specified slot for the Lex Dialogue Session
Returns formatted JSON response for Lex
"""
def elicit_slot(session_attributes, intent_name, slots, slot_to_elicit, message):
    return {
        'sessionAttributes': session_attributes,
        'dialogAction': {
            'type': 'ElicitSlot',
            'intentName': intent_name,
            'slots': slots,
            'slotToElicit': slot_to_elicit,
            'message': message
        }
    }

"""
close(session_attributes, fulfillment_state, message)

Closes the Lex Dialogue Session
Returns formatted JSON response for Lex
"""
def close(session_attributes, fulfillment_state, message):

    response = {
        'dialogAction': {
            'type': 'Close',
            'fulfillmentState': fulfillment_state,
            'message': message
        }

  }


    return response
"""
confirm_intent(intent_name,slots, message)


Confirms the intent of the user if we decide to implement a feature that requires confirmation
Returns formatted JSON response for Lex
"""
def confirm_intent(intent_name,slots, message):
    response = {
        'dialogAction': {
            'type': 'ConfirmIntent',
            'message': message,
            'intentName': intent_name,
            'slots': slots
        }
    }

    return response
"""
delegate(session_attributes, slots)


Delegates the handling of the intent to Lex
Returns formatted JSON response for Lex
"""
def delegate(session_attributes, slots):
    return {
        'sessionAttributes': session_attributes,
        'dialogAction': {
            'type': 'Delegate',
            'slots': slots
        }
    }

"""
make_message(message)

Makes a message that can be sent back to lex.
Message must be passed into on of the dialogAction methods above.
It cannot be sent independently to Lex
"""
def make_message(message):

    return {'contentType': 'PlainText', 'content': "{}".format(message)}


"""--------------------------Methods to Validate Data --------------------------"""


"""
build_validation_result(is_valid, violated_slot, message_content)


Builds a JSON object we can use to continue in the logic flow of our app
or request valid info from the end-user
"""
def build_validation_result(is_valid, violated_slot, message_content):
    if message_content is None:
        return {
            "isValid": is_valid,
            "violatedSlot": violated_slot,
        }

    return {
        'isValid': is_valid,
        'violatedSlot': violated_slot,
        'message': {'contentType': 'PlainText', 'content': message_content}
    }


"""
validate_reservation_logistics(city,cuisine, time, party_size)


Validates the user input for the slot values according to the contraints we impose
on the program.
"""
def validate_reservation_logistics(city,cuisine, time, party_size):

    city_validity = get_coordinates(city)
    party_size = int(party_size)
    time = int(time)

    if not city_validity:
        return build_validation_result(False, 'City', 'Please enter a valid city')
    if cuisine is None:
        return build_validation_result(False, 'cuisine', 'Please let me know what you would like to eat')
    if time and (time > 2359 or time < 0):
        return build_validation_result(False, 'Time', 'Please enter a valid timeframe')
    if party_size is None:
        return build_validation_result(False, 'size', 'Remember, you do count as one of the people going to dinner with yourself. Try party size of 1.')
    if party_size > 75:
        return build_validation_result(False, 'size', 'Sorry, we can only make reservations for parties with 75 people or less')


    return build_validation_result(True, None, None)

"""------------------------Network Methods ----------------------"""


"""
get_auth_header(api_key)

Get HTTP Authorization Header
Returns the auth header
"""
def get_auth_header(api_key):
        return {"Authorization": "Bearer {api_key}".format(api_key=api_key)}


"""--------------Functional Helper Methods----------------"""

"""
get_time(time)

Get's the time and converts it into a format usable by Yelp API
Begin Format: 00:00
End Format: 0000
"""
def get_time(time):

    #Check to see if time is of proper format
    if time is None:
        return None

    elif len(time)!=5:
        return None


    #Reformat the time and convert the time values into an integer representation
    #To allow for arithmetic
    [hours, minutes] = [int(x) for x in time.split(':')]

    hours = int(hours)*100
    minutes = int(minutes)

    return (hours+minutes)

"""
get_party_size(size)

Extract party size from event data
Returns integer value of party size or None if the slot is null
"""
def get_party_size(size):
    if size is None:
        return None
    else:
        return int(size)


"""
get_coordinates(city)


Takes in string input for the city name and
Returns (lattitude, longitude) if city is succesfully found using Google Geocoding API.
Returns 'None' if the city doesn't exists or if there is some server error.
"""
def get_coordinates(city):
    request_uri = 'https://maps.googleapis.com/maps/api/geocode/json?address={}&key=KEYGOESHERE'.format(
        city)
    response = requests.get(request_uri)
    response_data = response.json()


    if response_data['status'] != 'OK':
        #repromt user for data potentially? Don't know if should handle here.
        return None
    else:

        latitude = response_data['results'][0]['geometry']['location']['lat']
        longitude = response_data['results'][0]['geometry']['location']['lng']
        return (latitude, longitude)


"""
contact_yelp(coordinates, cuisine, time)

Contacts Yelp and finds open businesses with 4.0 or above rating
Returns: List of tuples (business_name, business_address[], image_url) of len(MAX_SUGGESTIONS) or less
Returns: None if no restaurants found
"""

def contact_yelp(coordinates, cuisine, time):
    #Suggestion list that we will return to method invoker
    suggestion_list = []

    #Get the day's integer representation to make reservations for today
    today = datetime.datetime.today().weekday()
    time = int(time)

    #Start a HTTP session and update session headers
    session = requests.Session()
    session.headers.update(get_auth_header("KEYGOESHERE"))

    #Query Yelp API for cuisine type in requested location at requested time
    response = session.get("https://api.yelp.com/v3/businesses/search?term={}&latitude={}&longitude={}".format(cuisine, coordinates[0], coordinates[1])).json()

    #Check to see if we received results from Yelp, assuming no results means no restaraunt matches for cuisine
    total_results = response.get('total')
    if total_results == 0:
        #return an error to choose another cuisine
        return None

    #Filter through restaurant results and return first size(MAX_SUGGESTIONS) or less restaurants
    for business in response.get('businesses'):
        #Skip business if handed a null object
        if business is None:
            continue

        #Filtering restaurants based on above average ratings
        if business.get('rating') >= 4:
            biz_id = business.get('id')
            biz_details = session.get("https://api.yelp.com/v3/businesses/{}".format(biz_id)).json()
            is_perm_closed = biz_details.get('is_closed')


            #Checking to see if the business is open and has their hours listed

            if not is_perm_closed and "hours" in biz_details:
                #Check retrieve the index associated with the value today matches their opening
                #Create boolean so we know to execute our search for the appropriate business
                work_week = biz_details.get('hours')[0].get('open')
                day_found = False
                today_index = 0
                for day in work_week:
                    if int(day.get('day')) == today:
                        day_found = True
                        today = today_index
                        break
                    else:
                        today_index += 1


                if day_found == True:
                    #Get the opening and closing hours for the business today
                    open_time = int(biz_details.get('hours')[0].get('open')[today].get('start'))
                    close_time = int(biz_details.get('hours')[0].get('open')[today].get('end'))


                    #Find open restaurants that can accept a reservation 45 minutes, latest time
                    #to make reservation is 45 minutes before closing.
                    #Add that suggestions as a tuple (name, address, image) to the suggestion_list list

                    #Test in AM when businesses aren't closed.
                    if time >= open_time and time <= close_time:
                        name = biz_details.get('name')
                        address = biz_details.get('location').get('display_address')
                        city = biz_details.get('location').get('city')
                        phone = biz_details.get('display_phone')
                        rating = biz_details.get('rating')
                        image = biz_details.get('image_url')
                        url = biz_details.get('url')

                        suggestion_list.append((name, address, city, phone, rating, image, url))

                #Sending suggestions back once we hit the max amount as defined by MAX_SUGGESTIONS
                if len(suggestion_list) == MAX_SUGGESTIONS:
                    return suggestion_list




    #If there are less than MAX_SUGGESTIONS suggestions, we handle that case here
    if len(suggestion_list) != 0:
        return suggestion_list

    #If we get nothing from our query, we return None
    else:
        return None

"""------------UX Flow --------------"""


"""
get_suggestions(event)

Driver for getting the dining suggestions
Takes in the event data from Lex, parses and validates it and then uses the data
To retrieve information from Google's Geocoding API and the Yelp API
"""
def get_suggestions(event):

    #Get the mapping for the different slots
    slots = get_slots(event)

    #Separate the slots for DiningSuggestionsIntent
    city =  slots['City']
    cuisine = slots['cuisine']
    time =  get_time(slots['Time'])
    party_size = get_party_size(slots['size'])

    #Extract invocation Source
    source = event['invocationSource']

    #Handle DialogCodeHook Source
    if source == 'DialogCodeHook':

        #When the user initially specifies the intent, delegate the handling to lex
        #We really only want to handle the edge cases and validate the data
        if not city:
            return delegate(event['sessionAttributes'], slots)
        elif not cuisine:
            return delegate(event['sessionAttributes'], slots)
        elif not time:
            return delegate(event['sessionAttributes'], slots)
        elif not party_size:
            return delegate(event['sessionAttributes'], slots)


        #Check the validity of the user input and if it's an appropriate request for the bot
        #Bypassing the validation_result check indicates we have all the necessary slots to call the yelp API
        validation_result = validate_reservation_logistics(city, cuisine, time, party_size)

        # Perform basic validation on the supplied input slots.
        # Use the elicitSlot dialog action to re-prompt for the first violation detected.

        if not validation_result['isValid']:
            #slots[validation_result['violatedSlot']] = None
            return elicit_slot(event['sessionAttributes'],
                               event['currentIntent']['name'],
                               slots,
                               validation_result['violatedSlot'],
                               validation_result['message'])

        #Get the (Lat, Long) coordinates for region of interest
        coordinates = get_coordinates(city)

        #Retrieve the dining suggestions from the Yelp API
        dining_suggestions = contact_yelp(coordinates, cuisine, time)

        #If no results returned, reprompt user to enter a different cuisine
        if dining_suggestions is None:
            return elicit_slot(event['sessionAttributes'],
                               event['currentIntent']['name'],
                               slots,
                               'cuisine',
                                make_message('Sorry, no {} restaurants are open right now in your area, please choose a different cuisine'.format(cuisine)))

        #Generate the suggestion message we are sending back to Lex to communicate to the user
        #Will send SUGGESTION_LENGTH messages back to the user

        num_suggestions = 0
        suggestion_message = ""
        while len(dining_suggestions) and num_suggestions < SUGGESTION_LENGTH:

            num_suggestions += 1

            suggestion = dining_suggestions.pop()
            suggestion_message += "{}) {} rated {} Located on {} in {} You can give them a call at {} +++ {} *** {} *** {} *** +++".format(num_suggestions,suggestion[0],suggestion[4],suggestion[1][0], suggestion[2], suggestion[3], suggestion[5],suggestion[0], suggestion[6])

        #Construct final output message to user
        greeting="Okay, for {} people we've found {} place that may satisfy your {} cravings: +".format(party_size, num_suggestions, cuisine)
        full_message = greeting + suggestion_message

        output_message = make_message(full_message)

        return close(event['sessionAttributes'], "Fulfilled", output_message)


"""-----------Intent Handling -------------"""

"""
dispatch(intent_request)


Handles each of the intents, if more than one.
"""
def dispatch(intent_request):
    """
    Called when the user specifies an intent for this bot.
    """

    logger.debug('dispatch userId={}, intentName={}'.format(intent_request['userId'], intent_request['currentIntent']['name']))

    intent_name = intent_request['currentIntent']['name']

    # Dispatch to the bot's intent handlers
    if intent_name == 'DiningSuggestionsIntent':
        return get_suggestions(intent_request)

    raise Exception('Intent with name ' + intent_name + ' not supported')

"""------------Main Handler -------------"""

def lambda_handler(event, context):

    return dispatch(event)
