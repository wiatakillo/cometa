#!/bin/bash

# ##################################################
# First time Cometa Setup Script
# ##################################################
#
# Changelog:
# 2023-08-12 RRO Added check on docker hub is reachable by downloading image "Hello-World"
# 2022-10-04 ASO changed sed logic and checking if docker is installed and running.
# 2022-10-03 ASO changing data mount point based on the parameter.
# 2022-09-08 RRO first version
#
VERSION="2023-12-08"

DOCKER_COMPOSE_COMMAND="docker-compose"
CURRENT_PATH=$PWD

#
# source our nice logger
#
HELPERS="helpers"
# source logger function if not sourced already
test `command -v log_wfr` || source "${HELPERS}/logger.sh" || exit

info "------------------------------------------------------------------------"
info "This is $0 version ${VERSION} running for your convinience"
info "------------------------------------------------------------------------"

########################################
#
# RETRY
# Retry for curl or any other command
# $1 {curl command}
# $2 {retries}
# $3 {wait retry}
#
#
########################################
function retry() {
    retries=${2:-60}
    wait_retry=${3:-10}
    i=0;
    exitCode=0;
    while [[ "$i" -lt "$retries" ]]; do
        eval $1;
        exitCode=$?
        if [[ "$exitCode" -ne 0 ]]; then
            sleep $wait_retry
            i=$((i+1))
        else
            break
        fi
    done
    return $exitCode
}

#
# Check if docker is working
#
function checkDocker() {
    # check if docker is installed
    if [[ ! $(command -v docker) ]]; then
        error "Docker not installed, please install Docker."
        exit 5;
    fi

    # check if docker is running.
    if [[ ! $(docker ps -a) ]]; then
        error "Either docker daemon is not running or user <${USER}> does not have permissions to use docker."
        info "Please start the docker service or ask your server administrator to add user <${USER}> to 'docker' group."
        exit 5;
    fi  

    # Get the current ulimit value
    current_ulimit=$(ulimit -n)
    
    info "Ulimit is to $current_ulimit."
    # Check if ulimit is less than 8192
    if [ "$current_ulimit" -lt 8192 ]; then
    error "Current ulimit is $current_ulimit which is not sufficient to run cometa."
    cat <<EOF 

Instructions to change ulimit :
    First Way
     1. Add the following line to your shell configuration file 
        e.g. In the file ~/.bashrc or ~/.bash_profile add below line
        
        ulimit -n 8192

     2. Restart your shell or run 'source ~/.bashrc' to apply the changes

    Second Way
     1. Open the /etc/security/limits.conf file in a text editor: i.e. sudo nano /etc/security/limits.conf
     2. Add the configuration, save and close the file

        * hard nofile 65536
        * soft nofile 65536 
     
     3. Restart your shell to apply the changes

Exit installation ... Exited
EOF
    exit 5;
    else
        info "Ulimit is set to 8192. ulimit is sufficient to run cometa "
    fi

    
    # Minimum required disk space in gigabytes
    minimum_disk_space=28

    # Get available disk space in gigabytes (using awk to extract the relevant information)
    available_disk_space=$(df -h /var/lib/docker | awk 'NR==2 { print $4 }' | sed 's/G//')

    info "Available disk space: $available_disk_space GB."

    # Check if available disk space is less than the minimum required
    if (( available_disk_space < minimum_disk_space )); then
        warning "Warning: Cometa Container normally use around $minimum_disk_space Available disk space is less than $minimum_disk_space GB. Consider freeing up space or upgrade."
        error "Exit installation ... Exited"
        exit 5;
    else
        info "Disk space is sufficient."
    fi


    # check if docker hub is reachable
    if [[ ! $(docker pull "hello-world" ) ]]; then
        error "Docker pull command did not excute correctly. Dockerhub is not reachable.";
        info "--------------------------------------------------------------------------"
        info "Please check your internet connection.";
        info "If running behind a secure proxy, check ~/.docker/config.json ";
        info "And check /etc/systemd/system/docker.service.d/http_proxy.conf to contain the needed";
        info "If you cannot find a solution, please contact us. We are happy to help you.";
        exit 5;
    else
        info "[OK] Checked that docker hub is reachable and images can be downloaded."
        docker rmi hello-world 2>&1 >/dev/null || info "Hello-world image could not be removed"
    fi
}

#
# Switches /data to ./data depending on the parameters
#
function switchDataMountPoint() {
    # check if first parameter contains root
    if [[ "$1" == "root" ]]; then
        # change ./data => /data
        sed -i_template "s#- \./data#- /data#g" docker-compose.yml
    else
        # change /data => ./data
        sed -i_template "s#- /data#- \./data#g" docker-compose.yml
    fi
}

function checkDockerCompose() {
    # Check if docker-compose is installed.
    if [[ ! -x "$(command -v docker-compose)" ]]; then
        # Check if docker compose is installed.
        if [[ ! $(docker compose version) ]]; then
            error "Missing docker compose and docker-compose. Please install docker compose and try again."
            exit 5;
        else
            DOCKER_COMPOSE_COMMAND="docker compose"
        fi
    fi
}

function checkDiskSpace() {
    # Disk space check. If too low, the script exits.
    if [[ $(df -h / | awk 'NR==2 {print $4}' | sed 's/G//') < 10 ]]; then
        error "Insufficient disk space."
        info "Please make sure you have at least 10Gb free on your disk for the installation."
        exit 5;
    fi
}

function checkCPUCores() {
    # Checks the total number of CPU's. If too low sends a warning.
    if [[ $(getconf _NPROCESSORS_ONLN) < 8 ]]; then
        info "Compared your CPU's core number to be at least 8."
        info "Your CPU has less than 8 cores. Cometa may perform slower than usual."
    fi
}

function checkRAMSpace() {
    # Checks the total RAM memory Gb. If too low sends a warning.
    if [[ $(free --si -g | awk '/^Mem/ {print $2}') < 8 ]]; then
        info "Compared your RAM memory to be at least 8Gb."
        info "Your RAM memory is lower than 8Gb. Cometa may run into performance issues."
    fi
}

function checkRequirements() {
    checkDocker
    checkDockerCompose
    checkDiskSpace
    checkCPUCores
    checkRAMSpace
}

function updateCrontab() {
    if ! ( crontab -l 2>/dev/null | grep -Fq "${1}" ); then
        ( crontab -l 2>/dev/null; echo "${1}" ) | crontab -
        debug "Crontab ${2}  created."
    else
        debug "Crontab ${2}  already exists."
    fi
}

function get_cometa_up_and_running() {

    #
    # Switch mount point based on MOUNTPOINT
    #
    switchDataMountPoint "${MOUNTPOINT:-local}"

    #
    # Create directory schedules
    #
    if [ ! -d backend/behave/schedules ]; then
        mkdir -p backend/behave/schedules && info "Created schedules directory"
    fi

    #
    # If crontab is a directory ... remove it
    #
    if [ -d backend/behave/schedules/crontab ]; then
        rm -rq backend/behave/schedules/crontab && info "Removed crontab directory"
    fi


    #
    # Touch crontab schedules
    #
    if [ ! -f backend/behave/schedules/crontab ]; then
        touch backend/behave/schedules/crontab && info "Created crontab file"
    fi

    #
    # Calls updateCrontab to update browsers and restart gunicorn
    #
    updateCrontab "0 0 * * * cd $CURRENT_PATH/backend/scripts && ./housekeeping.sh" "housekeeping.sh"
    updateCrontab "0 0 * * * bash -c \"docker exec cometa_django fuser -k -HUP 8000/tcp\"" "gunicorn"


    #
    # Replace <server> in docker-compose.yml with "local"
    #
    sed -i_template "s|<server>|local|g" docker-compose.yml && info "Replaced <server> in docker-compose.yml with local"

    #
    # Replace <outside_port> in docker-compose.yml with "80"
    #
    sed -i_template "s|<outside_port>|80|g" docker-compose.yml && info "Replaced <outside_port> in docker-compose.yml with 80"

    #
    # Check client id has been replaced
    #
    if grep -Rq "COMETA" "front/apache-conf/metadata/accounts.google.com.client"  ; then
        warning "Found default string in accounts.google.com.client file - you must replace this before going forward."
        read -n 1 -s -r -p "Press any key to continue"
        if grep -Rq "GITCLIENTID" "front/apache-conf/metadata/git.amvara.de.client"  ; then
            warning "Found default string in git.amvara.de.client file - you must replace this before going forward."
            warning "If neither Google nor Gitlab is configured, you will not be able to login."
            warning "Going forward with installation does not make sense, until SSO is configured. Exiting."
            warning "Goto git.amvara.de, create an account. Goto Settings, Applications, add new Application and retrieve your access token."
            exit
        else
            info "The default string in git.amvara.de.client was replaced with something else - hopefully your Gitlab oAuth client credentials";
        fi
    else
        info "The default string in accounts.google.com.client was replaced with something else - hopefully your google oAuth client credentials";
    fi

    #
    # Touch browsers.json
    #
    if [ ! -f backend/selenoid/browsers.json ] || [ $(cat backend/selenoid/browsers.json | grep . | wc -l) -eq 0 ]; then
        RUNSELENOIDSCRIPT=true
        echo "{}" > backend/selenoid/browsers.json && info "Created browsers.json file"
    fi

    #
    # Bring up the system
    #
    info "Starting containers"
    $DOCKER_COMPOSE_COMMAND up -d && info "Started docker ... now waiting for container to come alive " || warn "docker compose command finished with error"

    #
    # How to wait for System ready?
    #


    #
    # Check selenoid browsers
    #
    if [ "${RUNSELENOIDSCRIPT:-false}" = "true" ]; then
        info "Downloading latest browser versions"
        ./backend/selenoid/deploy_selenoid.sh -n 3 || warning "Something went wrong getting the latests browsers for the system"
    fi

    #
    # parse browsers and actions
    #

    # check health status
    # Max retries
    MAX_RETRIES=60
    # wait between retries
    WAIT_RETRY=10
    # Total timeout
    TOTAL_TIMEOUT=$(($MAX_RETRIES*$WAIT_RETRY))

    log_wfr "Waiting for parseBrowsers"
    retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseBrowsers/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

    log_wfr "Waiting for parseActions"
    retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseActions/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

    log_wfr "Waiting for frontend to compile angular typescript into executable code "
    retry "curl --fail --insecure https://localhost/ -o /dev/null  -s -L" && log_res "[done] Feeling happy " || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container front is not running"; }

} # end of function get_cometA_up_and_running

while [[ $# -gt 0 ]]
do
    case "$1" in
        --root-mount-point)
            MOUNTPOINT="root"
            shift
            ;;
    esac
done

checkRequirements
get_cometa_up_and_running

info "The test automation platform is ready to rumble at https://localhost/"
info "Thank you for using the easy peasy setup script."
