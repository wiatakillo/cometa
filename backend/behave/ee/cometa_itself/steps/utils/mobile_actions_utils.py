import base64
import time
import logging
import json
import sys, traceback
import sys, requests, re, json

import jq
from appium import webdriver as mobile_driver

from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions
from appium.options.common.base import AppiumOptions


sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *
from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *
from tools.service_manager import ServiceManager


# setup logging
logger = logging.getLogger("FeatureExecution")


def upload_file_to_appium_container(context, container_service_details_Id, file_path):
    file_full_path = uploadFileTarget(context, file_path)
    logger.debug(f"files to upload {file_full_path}")
    service_manager = ServiceManager()
    if type(file_full_path) == list:
        file_full_path = file_full_path[0]

    logger.debug("Uploading file")
    send_step_details(context, "Uploading file")
    file_name = service_manager.upload_file(
        service_name_or_id=container_service_details_Id,
        file_path=file_full_path,
        decryptFile=False,
    )
    if not file_name:
        raise CustomError(f"Can not upload the file {file_full_path}")
    return file_name


def perform_swipe(context, selector, x_offset, y_offset, direction):
    """
    Generic swipe function to swipe in a given direction.
    """
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating swipe {direction} action on element with {selector}",
    )
    logger.debug(
        f"Attempting to swipe {direction} on element with {selector} by offset ({x_offset}, {y_offset})"
    )
    
    # Find the element
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    
    # Ensure `elements` is a single WebElement
    if not isinstance(elements, WebElement):
        elements = elements[0]

    # Get element's width, height, and calculate center coordinates
    width = elements.size['width']
    height = elements.size['height']
    center_x = elements.location['x'] + width / 2
    center_y = elements.location['y'] + height / 2

    # Use W3C Actions API to perform the swipe
    actions = ActionChains(context.mobile["driver"])
    actions.w3c_actions.pointer_action.move_to_location(center_x, center_y)
    actions.w3c_actions.pointer_action.pointer_down()
    actions.w3c_actions.pointer_action.move_to_location(center_x + x_offset, center_y + y_offset)
    actions.w3c_actions.pointer_action.release()
    actions.perform()

    send_step_details(
        context, f"Swiped {direction} on element with {selector}"
    )
